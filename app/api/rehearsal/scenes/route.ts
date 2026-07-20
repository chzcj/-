import { ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { callFastJson, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { listTurnEvents } from '@/lib/server/memory/database-manager'
import { promptRegistry } from '@/lib/server/prompts/registry.generated'
import { REHEARSAL_SCENES } from '@/data/rehearsalScenes'
import {
  EXTENDED_SCENE_SEEDS,
  rankPainClusters,
  type PainClusterId,
} from '@/lib/server/rehearsal/scene-pain-ranker'

type HydratedScene = {
  id: string
  title: string
  subtitle: string
  lede?: string
  summary: string
  mentionCountHint?: string
  openingHint?: string
  openingChild?: string
  openingHintTitle?: string
  seed: string
}

type HydrateResponse = {
  scenes: Array<{
    id: string
    title?: string
    summary?: string
    subtitle?: string
    lede?: string
    mentionCountHint?: string
    openingHint?: string
  }>
}

function seedForCluster(id: PainClusterId): HydratedScene {
  const fromStatic = REHEARSAL_SCENES.find((s) => s.id === id)
  if (fromStatic) {
    return {
      id: fromStatic.id,
      title: fromStatic.title,
      subtitle: fromStatic.subtitle,
      summary: fromStatic.summary,
      openingHint: fromStatic.openingHint,
      openingChild: fromStatic.openingChild,
      openingHintTitle: fromStatic.openingHintTitle,
      seed: fromStatic.seed,
    }
  }
  const ext = EXTENDED_SCENE_SEEDS[id]
  return {
    id,
    title: ext.title,
    subtitle: ext.subtitle,
    summary: ext.summary,
    openingHint: ext.openingHint,
    openingChild: ext.openingChild,
    openingHintTitle: '他可能是这样听到的',
    seed: ext.seed,
  }
}

/**
 * Top5 痛点场景：turn_events 规则计频排序 → LLM 只润色 title/lede/summary；
 * mentionCountHint **一律代码覆盖**。
 */
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const tenant = await resolveTenant()
    const [packet, digestLoaded, turns] = await Promise.all([
      buildDailyDialogueRetrievalPacket('沟通预演场景', tenant, { fast: true }).catch(() => null),
      loadDeepModelDigest(tenant).catch(() => null),
      listTurnEvents(tenant, 400).catch(() => []),
    ])
    let digest = digestLoaded
    if (!digest?.mechanismNarrative) {
      digest = await buildDeepModelDigest(tenant).catch(() => digest)
    }
    const digestPack = pickDeepModelDigestPack(digest)

    const ranked = rankPainClusters(
      turns.map((t) => ({
        text: t.userMessage || '',
        createdAt: t.createdAt,
        mode: t.mode,
      })),
      { excludeRehearsalMode: true, topN: 5 }
    )

    const rankedScenes = ranked.map((r) => {
      const base = seedForCluster(r.id)
      return {
        ...base,
        mentionCountHint: r.mentionCountHint || undefined,
        _samples: r.samples,
        _n14: r.n14,
        _n90: r.n90,
      }
    })

    const hasMemory =
      ranked.some((r) => r.score > 0) ||
      Boolean(digestPack.mechanismNarrative?.trim()) ||
      Boolean(packet?.matchedMechanisms?.length) ||
      Boolean((packet as { entryFacts?: string[] } | null)?.entryFacts?.length)

    if (!hasMemory) {
      // 无信号：最多返回静态 3 条，不写假频次
      const fallback = REHEARSAL_SCENES.slice(0, 3).map((s) => seedForCluster(s.id as PainClusterId))
      return ok({ scenes: fallback, hydrated: false, rankedFromDialogue: false })
    }

    const result = await callFastJson<HydrateResponse>(
      [promptRegistry.parentFacingStyle, promptRegistry.rehearsalSceneHydrator].join('\n\n---\n\n'),
      {
        task: `为每个痛点场景生成贴合本家庭的 title（≤16字）、lede（≤48字）、summary（80–160字）、openingHint（60–120字）。mentionCountHint 由代码填写，你不要输出次数。`,
        scenes: rankedScenes.map((s) => ({
          id: s.id,
          title: s.title,
          intent: s.summary,
          sampleQuotes: s._samples || [],
          codeMentionHint: s.mentionCountHint || '',
        })),
        deepModelDigest: digestPack,
        retrievalPack: packet
          ? {
              matchedMechanisms: packet.matchedMechanisms || [],
              familyPatterns: packet.familyInteractionPatterns || [],
              entryFacts: (packet as { entryFacts?: string[] }).entryFacts || [],
              childQuotes: (packet as { childQuotes?: string[] }).childQuotes || [],
            }
          : undefined,
      },
      { maxTokens: 2800, disableThinking: frontAiThinkingDisabled() }
    )

    const byId = new Map((result?.scenes || []).map((s) => [s.id, s]))
    const scenes: HydratedScene[] = rankedScenes.map((base) => {
      const patch = byId.get(base.id)
      return {
        id: base.id,
        title: patch?.title?.trim() || base.title,
        subtitle: patch?.lede?.trim() || patch?.subtitle?.trim() || base.subtitle,
        lede: patch?.lede?.trim() || patch?.subtitle?.trim() || base.subtitle,
        // 硬规则：频次只认代码
        mentionCountHint: base.mentionCountHint,
        summary: patch?.summary?.trim() || base.summary,
        openingHint: patch?.openingHint?.trim() || base.openingHint,
        openingChild: base.openingChild,
        openingHintTitle: base.openingHintTitle,
        seed: base.seed,
      }
    })

    return ok({
      scenes,
      hydrated: true,
      rankedFromDialogue: ranked.some((r) => r.score > 0),
    })
  } catch (error) {
    return failFromError(error)
  }
}

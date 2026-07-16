import { ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { callFastJson, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { REHEARSAL_SCENES } from '@/data/rehearsalScenes'

type HydratedScene = {
  id: string
  title: string
  subtitle: string
  summary: string
  openingHint?: string
  openingChild?: string
  openingHintTitle?: string
  seed: string
}

type HydrateResponse = {
  scenes: Array<{
    id: string
    summary?: string
    subtitle?: string
    openingHint?: string
  }>
}

/**
 * 固定预演场景记忆化：用 digest + retrieval 改写 summary/openingHint。
 * 失败时前端仍用静态文案。关 thinking，厚记忆只放 user。
 */
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const tenant = await resolveTenant()
    const [packet, digestLoaded] = await Promise.all([
      buildDailyDialogueRetrievalPacket('沟通预演场景', tenant, { fast: true }).catch(() => null),
      loadDeepModelDigest(tenant).catch(() => null),
    ])
    let digest = digestLoaded
    if (!digest?.mechanismNarrative) {
      digest = await buildDeepModelDigest(tenant).catch(() => digest)
    }
    const digestPack = pickDeepModelDigestPack(digest)

    const staticScenes = REHEARSAL_SCENES.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      summary: s.summary,
      openingHint: s.openingHint,
      openingChild: s.openingChild,
      openingHintTitle: s.openingHintTitle,
      seed: s.seed,
    }))

    const hasMemory =
      Boolean(digestPack.mechanismNarrative?.trim()) ||
      Boolean(packet?.matchedMechanisms?.length) ||
      Boolean((packet as { entryFacts?: string[] } | null)?.entryFacts?.length)

    if (!hasMemory) {
      return ok({ scenes: staticScenes as HydratedScene[], hydrated: false })
    }

    const result = await callFastJson<HydrateResponse>(
      `你是「育见」沟通预演场景润色助手。面向家长，用大白话把固定场景摘要改成贴合这个家庭的版本。
规则：不评判家长；不编造未出现的事实；材料不足就保留通用说法并略作口语化；禁止学名/机制矩阵词；只输出 JSON。`,
      {
        task: `为每个固定场景生成贴合本家庭的 summary（80–160字）、subtitle（一句≤40字）、openingHint（60–120字）。保留场景意图，注入家庭具体材料。`,
        scenes: staticScenes.map((s) => ({ id: s.id, title: s.title, intent: s.summary })),
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
      { maxTokens: 2200, disableThinking: frontAiThinkingDisabled() }
    )

    const byId = new Map((result?.scenes || []).map((s) => [s.id, s]))
    const scenes: HydratedScene[] = staticScenes.map((base) => {
      const patch = byId.get(base.id)
      return {
        ...base,
        subtitle: patch?.subtitle?.trim() || base.subtitle,
        summary: patch?.summary?.trim() || base.summary,
        openingHint: patch?.openingHint?.trim() || base.openingHint,
      }
    })

    return ok({ scenes, hydrated: true })
  } catch (error) {
    return failFromError(error)
  }
}

import { ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { callFastJson, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { promptRegistry } from '@/lib/server/prompts/registry.generated'
import { REHEARSAL_SCENES } from '@/data/rehearsalScenes'

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
      [promptRegistry.parentFacingStyle, promptRegistry.rehearsalSceneHydrator].join('\n\n---\n\n'),
      {
        task: `为每个固定场景生成贴合本家庭的 title（≤16字）、lede（≤48字）、mentionCountHint（如「近2周 · 提过3次」或「近期提过」）、summary（80–160字）、openingHint（60–120字）。`,
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
        title: patch?.title?.trim() || base.title,
        subtitle: patch?.lede?.trim() || patch?.subtitle?.trim() || base.subtitle,
        lede: patch?.lede?.trim() || patch?.subtitle?.trim() || base.subtitle,
        mentionCountHint: patch?.mentionCountHint?.trim(),
        summary: patch?.summary?.trim() || base.summary,
        openingHint: patch?.openingHint?.trim() || base.openingHint,
      }
    })

    return ok({ scenes, hydrated: true })
  } catch (error) {
    return failFromError(error)
  }
}

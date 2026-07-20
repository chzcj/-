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

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const body = (await request.json()) as { sceneId?: string }
    const sceneId = body.sceneId || REHEARSAL_SCENES[0].id
    const base = REHEARSAL_SCENES.find((s) => s.id === sceneId) || REHEARSAL_SCENES[0]
    const tenant = await resolveTenant()

    const [packet, digestLoaded] = await Promise.all([
      buildDailyDialogueRetrievalPacket(base.title, tenant, { fast: true }).catch(() => null),
      loadDeepModelDigest(tenant).catch(() => null),
    ])
    let digest = digestLoaded
    if (!digest?.mechanismNarrative) {
      digest = await buildDeepModelDigest(tenant).catch(() => digest)
    }
    const digestPack = pickDeepModelDigestPack(digest)

    const llm = await callFastJson<{
      sceneSituation?: string
      childUnderstanding?: string
      openingHint?: string
    }>(
      [promptRegistry.parentFacingStyle, promptRegistry.rehearsalSceneBrief].join('\n\n---\n\n'),
      {
        sceneId: base.id,
        sceneTitle: base.title,
        sceneIntent: base.summary,
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
      { maxTokens: 1024, disableThinking: frontAiThinkingDisabled() }
    ).catch(() => undefined)

    return ok({
      sceneId: base.id,
      sceneTitle: base.title,
      sceneSituation: llm?.sceneSituation?.trim() || base.summary,
      childUnderstanding:
        llm?.childUnderstanding?.trim() ||
        '还在根据你们的交流慢慢补全；可以先按这个场景练一版开口。',
      openingHint: llm?.openingHint?.trim() || base.openingHint,
    })
  } catch (error) {
    return failFromError(error)
  }
}

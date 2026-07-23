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
import { EXTENDED_SCENE_SEEDS, type PainClusterId } from '@/lib/server/rehearsal/scene-pain-ranker'

function resolveSceneSeed(sceneId: string) {
  const fromStatic = REHEARSAL_SCENES.find((s) => s.id === sceneId)
  if (fromStatic) return fromStatic
  const ext = EXTENDED_SCENE_SEEDS[sceneId as PainClusterId]
  if (ext) {
    return {
      id: sceneId,
      title: ext.title,
      subtitle: ext.subtitle,
      summary: ext.summary,
      placeholder: '',
      seed: ext.seed,
      openingHint: ext.openingHint,
      openingChild: ext.openingChild,
    }
  }
  return REHEARSAL_SCENES[0]
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const body = (await request.json()) as {
      sceneId?: string
      parentText?: string
      rehearsalGoal?: string
      retrievalPackDigest?: {
        understandingCard?: string
        evidenceBasis?: string
        deepAnalysis?: string[]
        adviceSeed?: string
        confidenceMode?: string
        linkedAreas?: string[]
      }
    }
    const sceneId = body.sceneId || REHEARSAL_SCENES[0].id
    const base = resolveSceneSeed(sceneId)
    const tenant = await resolveTenant()

    // v4 P0-4a：如果有交流页带来的 parentText，用它做检索 query（比场景标题语义更准）
    const retrievalQuery = body.parentText || base.title
    const [packet, digestLoaded] = await Promise.all([
      buildDailyDialogueRetrievalPacket(retrievalQuery, tenant, { fast: true }).catch(() => null),
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
      understandingBullets?: string[]
      openingHint?: string
      openingChild?: string
      openingHintTitle?: string
      initialStatusText?: string
    }>(
      [promptRegistry.parentFacingStyle, promptRegistry.rehearsalSceneBrief].join('\n\n---\n\n'),
      {
        sceneId: base.id,
        sceneTitle: base.title,
        sceneIntent: base.summary,
        // v4 P0-4a：携带交流页上下文
        parentText: body.parentText || '',
        rehearsalGoal: body.rehearsalGoal || '',
        retrievalPackDigest: body.retrievalPackDigest || null,
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

    const bullets = (llm?.understandingBullets || [])
      .map((b) => String(b || '').trim())
      .filter((b) => b.length > 4)
      .slice(0, 3)
    const childUnderstanding =
      bullets.length >= 2
        ? bullets.join('\n')
        : llm?.childUnderstanding?.trim() ||
          '还在根据你们的交流慢慢补全；可以先按这个场景练一版开口。'

    return ok({
      sceneId: base.id,
      sceneTitle: base.title,
      sceneSituation: llm?.sceneSituation?.trim() || base.summary,
      childUnderstanding,
      understandingBullets:
        bullets.length >= 2
          ? bullets
          : childUnderstanding
              .split(/\n+/)
              .map((line) => line.replace(/^[-•·\d.)]+\s*/, '').trim())
              .filter((line) => line.length > 4)
              .slice(0, 3),
      openingHint: llm?.openingHint?.trim() || base.openingHint,
      openingChild: llm?.openingChild?.trim() || base.openingChild,
      openingHintTitle: llm?.openingHintTitle?.trim() || base.openingHintTitle || '他可能是这样想的',
      initialStatusText:
        llm?.initialStatusText?.trim() ||
        (bullets[0]
          ? `当前状态：${bullets[0].slice(0, 36)}${bullets[0].length > 36 ? '…' : ''}`
          : undefined),
    })
  } catch (error) {
    return failFromError(error)
  }
}

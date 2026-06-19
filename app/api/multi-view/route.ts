import { ok, failFromError } from '@/lib/api-response'
import { callAgentJson } from '@/lib/server/ark-agents'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { retrieveContextPack } from '@/lib/server/memory/retrieval/episode-retriever'
import { getEntryEvidencePack } from '@/lib/server/memory/database-manager'
import { buildMemoryWritePlan, createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import { createId } from '@/lib/storage/storageIds'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'

/* ================================================================
   多视角校正 multi-view（家长 / 孩子 / 老师三方）。
   把家长画像、孩子原话、老师/学校事实放一起，让家长松动单一解读。
   老师视角只基于已有环境入口事实，没有就诚实说不清楚——绝不编造。
   ================================================================ */

type MultiViewOutput = {
  headline?: string
  summary?: string
  parentView?: string
  childView?: string
  teacherView?: string
  finalChips?: string[]
}

const TEACHER_UNKNOWN = '学校那边目前还不清楚，可以后续补充。'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const body = await request.json().catch(() => ({}))
    const childText: string = typeof body.childText === 'string' ? body.childText.trim() : ''

    const traceId = createId('trace')
    const tenant = await resolveTenant()

    // 家长视角素材：已有画像与机制。
    const query = childText || '孩子最近在家和在学校的状态'
    const packet = await buildDailyDialogueRetrievalPacket(query, tenant).catch(() => undefined)
    const parentUnderstanding = (packet?.relevantChildStructureModels || []).slice(0, 3)
    const matchedMechanisms = (packet?.matchedMechanisms || []).slice(0, 4)

    // 孩子视角素材：记忆里的孩子原话 + 本次输入。
    const pack = childText
      ? await retrieveContextPack(childText, { familyId: tenant.familyId, childId: tenant.childId }).catch(() => undefined)
      : undefined
    const memChildQuotes = pack
      ? [
          ...pack.episodes.flatMap(e => e.atoms.filter(a => a.sourceType === 'child_quote').map(a => a.content)),
          ...pack.extraHighValueAtoms.filter(a => a.sourceType === 'child_quote').map(a => a.content),
        ].slice(0, 6)
      : []
    const childQuotes = [childText, ...memChildQuotes].filter(Boolean)

    // 老师视角素材：仅来自关系环境入口的学校/老师事实，没有就留空（不编造）。
    const envPack = await getEntryEvidencePack('relationship_environment', tenant).catch(() => null)
    const teacherFacts = envPack
      ? [envPack.rawInputSummary, ...envPack.decomposedInput.verifiableFacts].filter(Boolean).slice(0, 5)
      : []

    const ai = await callAgentJson<MultiViewOutput>(
      'multiViewCorrection',
      '把家长视角（parentUnderstanding/matchedMechanisms）、孩子自己的话（childVoice/childQuotes）、老师学校观察（teacherFacts）三方放一起做多视角校正。teacherFacts 为空就诚实说学校还不清楚，不要编造。',
      { childVoice: childText, childQuotes, parentUnderstanding, matchedMechanisms, teacherFacts }
    ).catch((err) => {
      console.error(`[multi-view] LLM 调用失败 traceId=${traceId}:`, err)
      return undefined
    })

    // 孩子原话写回记忆（异步，幂等）：进入 child_quote，丰富家庭模型；下次多视角更准。
    if (childText) {
      const episodeId = deriveEpisodeId(childText, { familyId: tenant.familyId, childId: tenant.childId })
      void enqueueJob('episode_ingest', {
        text: childText,
        ctx: { sourceEventId: traceId, familyId: tenant.familyId, childId: tenant.childId, episodeId, recentContext: '孩子视角输入' }
      }, episodeId, traceId)
      const plan = buildMemoryWritePlan({
        tenant,
        dailyUpdates: [createDailyUpdate(`[孩子视角] ${childText}`, 'new_supporting_evidence', matchedMechanisms, tenant, traceId)],
        rationale: { whyUpdate: '孩子视角输入，记录孩子自己的话', whyNotPromoteSomeItems: '单条孩子原话，待更多印证', riskOfOvergeneralization: '', nextVerificationNeed: '' },
      })
      void enqueueJob('memory_write', { plan, tenant }, null, traceId)
    }

    const hasTeacher = teacherFacts.length > 0
    return ok({
      traceId,
      headline: textOr(ai?.headline, '同一件事，家长、孩子、老师看到的可能很不一样。'),
      summary: textOr(ai?.summary, childText
        ? '把三方放在一起看，孩子不是单纯不用心——他在不同关系里的状态不一样，值得分开理解。'
        : '先听听孩子自己怎么说，再把家长和学校的观察放进来，会看得更全。'),
      parentView: textOr(ai?.parentView, parentUnderstanding[0] || '家长更多看到的是表面的拖延和不配合。'),
      childView: textOr(ai?.childView, childText || (memChildQuotes[0] || '还没有听到孩子自己的话，可以先请他说一段。')),
      teacherView: hasTeacher ? textOr(ai?.teacherView, teacherFacts[0]) : TEACHER_UNKNOWN,
      finalChips: normalizeChips(ai?.finalChips),
    })
  } catch (error) {
    return failFromError(error)
  }
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeChips(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map(c => c.trim()).slice(0, 4)
}

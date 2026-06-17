import { NextResponse } from 'next/server'
import { callAgentJson } from '@/lib/server/ark-agents'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { buildMemoryWritePlan, createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import { decideFeatureUI } from '@/lib/server/features/feature-ui-router'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'
import { createId } from '@/lib/storage/storageIds'

/* ================================================================
   家庭综合规划 family_planner（交付文档 5.4）
   从家庭真实承受力反推少量可执行动作；不生成密集时间表。
   ================================================================ */

type FamilyPlanAction = { title: string; detail: string }
type FamilyPlanOutput = {
  enoughToPlan?: boolean
  acknowledgement: string
  boundaryFirst: string
  actions: FamilyPlanAction[]
  missingInfo: string
  note: string
}

// FAST_AI 未启用或调用失败时的降级文案，保证功能始终可用。
const FALLBACK: FamilyPlanOutput = {
  acknowledgement: '我先不急着给你排一堆计划。你愿意把家里现在的情况讲出来，这一步已经够了。',
  boundaryFirst: '先挑一件最常引发冲突的事（作业起点 / 手机时段 / 睡前），把它固定住，其它先不动——让孩子和你都先有个能喘口气的地方。',
  actions: [
    { title: '先稳一个边界', detail: '只固定一件最常崩的事，比如"作业从晚饭后半小时开始"，其余暂时维持原样。' },
    { title: '只看一两周', detail: '这两周不追加新任务，先观察孩子在这个边界下的反应，随手记一两笔。' }
  ],
  missingInfo: '如果之前也试过类似安排但没坚持下来，能说说卡在了哪一步吗？是孩子抗拒、你没时间盯，还是冲突变多？',
  note: '先看一两周，不行我们再一起调，不用一次到位。'
}

export async function POST(request: Request) {
  if (!verifyInternalApi(request)) return authError()

  try {
    const body = await request.json()
    const { text = '' } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message: '可以多讲一点家里的情况' }
      }, { status: 400 })
    }

    const userText = text.trim()
    const traceId = createId('trace')

    // 读 FamilyModel/记忆上下文（既往尝试、家庭承受力边界），喂给 LLM。
    const tenant = await resolveTenant()
    const packet = await buildDailyDialogueRetrievalPacket(userText, tenant)
    const familyContext = {
      childUnderstanding: packet.relevantChildStructureModels.slice(0, 3),
      pastPlansAndEvents: packet.recentRelatedEvents.slice(0, 6), // 既往尝试/失败线索
      supportingEvidence: packet.supportingEvidence.slice(0, 5),
      pendingHypotheses: packet.pendingHypotheses.slice(0, 3),     // 家庭资源/承受力待验证点
      matchedMechanisms: packet.matchedMechanisms.slice(0, 4)
    }

    const ai = await callAgentJson<Partial<FamilyPlanOutput>>(
      'familyPlanner',
      '基于家长讲述的家庭情况与已掌握的家庭理解（familyContext），给出少量、可承受的下一步动作。必须参考既往尝试过的安排与家庭承受力边界，不重复已失败的安排、不超出家庭资源。',
      { userText, familyContext }
    ).catch((err) => {
      console.error(`[family-planner] LLM 调用失败 traceId=${traceId}:`, err)
      return undefined
    })

    // 充分性门槛（文档 5.4.3 + 红线"信息不足不硬生成"）：失败节点不清 → 只追问、不出计划。
    // LLM 不可用(ai 为 undefined)时无法判断充分度，也视为不足 → 走轻追问，绝不用 FALLBACK 拼一个泛泛计划。
    const insufficient = !ai || ai.enoughToPlan === false
    const plan: FamilyPlanOutput = insufficient
      ? {
          enoughToPlan: false,
          acknowledgement: textOr(ai?.acknowledgement, '我先不急着给你排计划——想先弄清一个点，免得又定一个坚持不下来的安排。'),
          boundaryFirst: '',
          actions: [],
          missingInfo: textOr(ai?.missingInfo, FALLBACK.missingInfo),
          note: '把这一点说清楚，我们就能定一两个你真能坚持的动作。'
        }
      : {
          acknowledgement: textOr(ai?.acknowledgement, FALLBACK.acknowledgement),
          boundaryFirst: textOr(ai?.boundaryFirst, FALLBACK.boundaryFirst),
          actions: normalizeActions(ai?.actions),
          missingInfo: typeof ai?.missingInfo === 'string' ? ai.missingInfo.trim() : '',
          note: textOr(ai?.note, FALLBACK.note)
        }

    // 把本次规划输入与产出写回记忆（异步，不阻塞）；下次规划可检索本次产出，memory_write 链式触发 digest_update。
    const writePlan = buildMemoryWritePlan({
      tenant,
      dailyUpdates: [createDailyUpdate(
        `[家庭规划] 家长输入：${userText}｜先稳边界：${plan.boundaryFirst}｜动作：${plan.actions.map(a => a.title).join('、')}`,
        'insufficient', // 规划属操作建议，不误增稳定画像权重
        packet.matchedMechanisms,
        tenant,
        traceId
      )],
      rationale: {
        whyUpdate: '家庭综合规划完成，记录本次输入与产出动作',
        whyNotPromoteSomeItems: '规划属操作建议，暂不升级为长期判断',
        riskOfOvergeneralization: '',
        nextVerificationNeed: plan.missingInfo || ''
      }
    })
    void enqueueJob('memory_write', { plan: writePlan, tenant }, null, traceId)
    // Episode 抽取统一走队列（对齐 daily / 其它专项）：让规划叙述的家庭事实可被下一轮检索、job 可追踪。
    const episodeId = deriveEpisodeId(userText, { familyId: tenant.familyId, childId: tenant.childId })
    void enqueueJob('episode_ingest', {
      text: userText,
      ctx: { sourceEventId: traceId, familyId: tenant.familyId, childId: tenant.childId, episodeId }
    }, episodeId, traceId)

    // 5.3 UI 切换：失败节点不清(insufficient)→轻追问；出计划→结果展示。前台不暴露 readiness。
    const router = decideFeatureUI({
      featureType: 'family_planner',
      hasExistingContextPack: true,
      contextReadiness: insufficient ? 'partial' : 'ready',
      missingHighImpactFacts: insufficient && plan.missingInfo ? [plan.missingInfo] : [],
      userIntent: 'unclear',
      currentQuestionSpan: 'same_topic'
    })

    return NextResponse.json({ ok: true, data: { traceId, uiMode: router.uiMode, plan } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'FAMILY_PLANNER_ERROR', message: String(error) }
    }, { status: 500 })
  }
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeActions(value: unknown): FamilyPlanAction[] {
  if (!Array.isArray(value)) return FALLBACK.actions
  const actions = value
    .filter((item): item is FamilyPlanAction =>
      Boolean(item) && typeof item === 'object'
      && typeof (item as FamilyPlanAction).title === 'string'
      && typeof (item as FamilyPlanAction).detail === 'string'
      && (item as FamilyPlanAction).title.trim().length > 0
    )
    .slice(0, 3)
    .map((item) => ({ title: item.title.trim(), detail: item.detail.trim() }))
  return actions.length > 0 ? actions : FALLBACK.actions
}

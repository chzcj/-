import { NextResponse } from 'next/server'
import { callAgentJson } from '@/lib/server/ark-agents'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'
import { createId } from '@/lib/storage/storageIds'

/* ================================================================
   家庭综合规划 family_planner（交付文档 5.4）
   从家庭真实承受力反推少量可执行动作；不生成密集时间表。
   ================================================================ */

type FamilyPlanAction = { title: string; detail: string }
type FamilyPlanOutput = {
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

    const ai = await callAgentJson<Partial<FamilyPlanOutput>>(
      'familyPlanner',
      '基于家长讲述的家庭情况，给出少量、可承受的下一步动作。',
      { userText }
    ).catch((err) => {
      console.error(`[family-planner] LLM 调用失败 traceId=${traceId}:`, err)
      return undefined
    })

    // LLM 字段逐项兜底，actions 强制收敛到 1-3 个（交付文档 5.4.3）。
    const plan: FamilyPlanOutput = {
      acknowledgement: textOr(ai?.acknowledgement, FALLBACK.acknowledgement),
      boundaryFirst: textOr(ai?.boundaryFirst, FALLBACK.boundaryFirst),
      actions: normalizeActions(ai?.actions),
      missingInfo: typeof ai?.missingInfo === 'string' ? ai.missingInfo.trim() : '',
      note: textOr(ai?.note, FALLBACK.note)
    }

    return NextResponse.json({ ok: true, data: { traceId, plan } })
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

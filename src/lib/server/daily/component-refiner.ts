import 'server-only'

import type { DailyCards, OrchestrationOutput } from '@/types/database'
import {
  DAILY_COMPONENT_LABELS,
  enumerateDailyComponentCandidates,
  selectDailyComponents,
  type DailyComponentId,
} from '@/lib/daily/selectDailyComponents'
import { callFastJson, frontAiThinkingDisabled, isFastAIEnabled } from '@/lib/server/ark-agents'

const MAX = 3

type RefineResult = { components?: string[] }

export function buildDailyComponentPick(
  output: OrchestrationOutput,
  cards: Omit<DailyCards, 'activeComponents'>,
  linkedAreas: string[]
) {
  const candidates = enumerateDailyComponentCandidates(output, cards, linkedAreas)
  const rulePick = selectDailyComponents(output, cards, linkedAreas)
  return { candidates, rulePick }
}

/**
 * LLM 二次挑选：在规则引擎候选池里选最多 3 个最适合本轮的 UI 组件。
 * 失败或未配置 key 时回退 rulePick。
 */
export async function refineDailyActiveComponents(args: {
  output: OrchestrationOutput
  cards: Omit<DailyCards, 'activeComponents'>
  userText: string
  linkedAreas: string[]
  candidates: DailyComponentId[]
  rulePick: DailyComponentId[]
}): Promise<DailyComponentId[]> {
  const { output, cards, userText, linkedAreas, candidates, rulePick } = args
  if (!isFastAIEnabled() || candidates.length <= MAX) {
    return rulePick.slice(0, MAX)
  }

  try {
    const refined = await callFastJson<RefineResult>(
      `你是日常对话前台 UI 编排助手。家长刚说了一段话，系统已生成主回复气泡。
你的任务：从「候选组件」中选出最多 3 个最适合本轮展示的附加 UI 块。

选择依据（按优先级）：
1. 家长意图（inputType）：求建议→偏 advice_hint/action_task；想预演→action_rehearsal；倾诉/报告→evidence/deep_reading
2. 置信度（confidenceMode=low）：优先 follow_up，避免同时堆太多判断
3. 是否已有家庭画像证据：高置信且有 evidenceBasis 时可出 evidence 或 deep_reading
4. 关系信号 counter_evidence/new_mechanism_signal 时可出 judgment_delta
5. 动作类组件（预演/任务）每轮最多选 1 个，不要与 follow_up 抢注意力

只输出 JSON：{"components":["id1","id2"]}，id 必须严格来自 candidates 列表。不要输出解释。`,
      {
        userText: userText.slice(0, 500),
        intent: output.inputType,
        confidenceMode: cards.confidenceMode,
        relationship: output.relationshipToExistingModel.type,
        frontResponseType: output.routingDecision.frontResponseType,
        needFollowup: output.routingDecision.needFollowup,
        linkedAreas,
        candidates: candidates.map((id) => ({ id, label: DAILY_COMPONENT_LABELS[id] })),
        ruleSuggestion: rulePick,
        hasEvidence: Boolean(cards.evidenceBasis),
        hasDeepReading: Boolean(cards.understandingCard?.reading),
        hasDeepAnalysis: Boolean(cards.deepAnalysis?.points?.length),
      },
      { disableThinking: frontAiThinkingDisabled() }
    )

    const valid = (refined?.components || []).filter(
      (id): id is DailyComponentId => candidates.includes(id as DailyComponentId)
    )
    if (valid.length > 0) return valid.slice(0, MAX)
  } catch (err) {
    console.error('[daily/component-refiner] LLM refine failed:', err)
  }

  return rulePick.slice(0, MAX)
}

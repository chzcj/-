import type { DailyCards, OrchestrationOutput } from '@/types/database'

export type DailyComponentId =
  | 'judgment_delta'
  | 'evidence'
  | 'deep_reading'
  | 'advice_hint'
  | 'linked_areas'
  | 'action_rehearsal'
  | 'action_task'

const MAX_COMPONENTS = 3

/**
 * 枚举本轮所有可展示的组件（按优先级排序，不限数量）。
 * 规则引擎第一层：决定「有什么可选」。
 */
export function enumerateDailyComponentCandidates(
  output: OrchestrationOutput,
  cards: Omit<DailyCards, 'activeComponents'>,
  linkedAreas: string[] = []
): DailyComponentId[] {
  const picked: DailyComponentId[] = []
  const lowConf = cards.confidenceMode === 'low'
  const route = output.routingDecision
  const rel = output.relationshipToExistingModel.type
  const intent = output.inputType

  const tryPush = (id: DailyComponentId) => {
    if (picked.includes(id)) return
    picked.push(id)
  }

  if (intent === 'ask_advice') {
    if (cards.adviceSeed) tryPush('advice_hint')
    tryPush('action_task')
  } else if (intent === 'ask_rehearsal') {
    tryPush('action_rehearsal')
    if (cards.evidenceBasis && !lowConf) tryPush('evidence')
  } else if (
    intent === 'emotional_vent' ||
    intent === 'self_blame' ||
    intent === 'daily_observation' ||
    intent === 'new_fact'
  ) {
    if (cards.evidenceBasis && !lowConf) tryPush('evidence')
    if (cards.understandingCard?.reading) tryPush('deep_reading')
  } else if (intent === 'ask_explanation' || route.needDeepDiagnosis) {
    if (cards.evidenceBasis) tryPush('evidence')
  }

  if (cards.judgmentDelta && (rel === 'counter_evidence' || rel === 'new_mechanism_signal')) {
    tryPush('judgment_delta')
  }

  if (!lowConf && cards.understandingCard?.reading) tryPush('deep_reading')
  if (!lowConf && cards.evidenceBasis) tryPush('evidence')

  if (
    (intent === 'ask_advice' || route.frontResponseType === 'model_based_explanation') &&
    !picked.includes('action_rehearsal')
  ) {
    tryPush('action_rehearsal')
  }

  if (linkedAreas.length > 0) tryPush('linked_areas')

  return picked
}

/** 规则引擎默认挑选（最多 3 个），无 LLM 时的兜底 */
export function selectDailyComponents(
  output: OrchestrationOutput,
  cards: Omit<DailyCards, 'activeComponents'>,
  linkedAreas: string[] = []
): DailyComponentId[] {
  return enumerateDailyComponentCandidates(output, cards, linkedAreas).slice(0, MAX_COMPONENTS)
}

export const DAILY_COMPONENT_LABELS: Record<DailyComponentId, string> = {
  judgment_delta: '判断有更新',
  evidence: '为什么这样看',
  deep_reading: '结合家庭的理解',
  advice_hint: '家里流程提示',
  linked_areas: '关联领域',
  action_rehearsal: '去沟通预演',
  action_task: '今晚试一次',
}

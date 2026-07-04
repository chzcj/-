import type { DailyCards, OrchestrationOutput } from '@/types/database'
import type { DailySection } from '@/types/daily-message'

function isHighConfidence(cards: DailyCards, output: OrchestrationOutput): boolean {
  const rel = output.relationshipToExistingModel.type
  if (rel === 'insufficient') return false

  return (
    cards.confidenceMode !== 'low' &&
    output.routingDecision.frontResponseType !== 'one_key_followup'
  )
}

function composeHighConfidenceSkeleton(): DailySection[] {
  const sections: DailySection[] = [
    { id: 'diagnosis_headline', label: '深度分析', kind: 'paragraphs', paragraphs: [] },
    { id: 'history_thinking', label: '判断依据', kind: 'list', items: [] },
    { id: 'advice', label: '今晚先这样试', kind: 'paragraphs', paragraphs: [] },
    {
      id: 'profile_reading',
      label: '结合孩子画像的分析',
      kind: 'paragraphs',
      paragraphs: [],
      hidden: true,
    },
    {
      id: 'child_voice',
      label: '孩子可能怎么想',
      kind: 'quotes',
      quotes: [],
      note: '以上不是孩子原话，而是基于过往情境和本次表现的推测。',
      hidden: true,
    },
  ]
  return sections
}

function composeLowConfidenceSkeleton(): DailySection[] {
  return [
    { id: 'directions', label: '目前有几个可能方向', kind: 'list', items: [] },
    { id: 'this_time', label: '这次更像是', kind: 'paragraphs', paragraphs: [] },
    {
      id: 'follow_up',
      label: '追问',
      kind: 'mixed',
      paragraphs: [],
      items: [],
      note: '可以讲得乱一点、长一点，这会直接影响后面判断。',
    },
  ]
}

function composeRiskFollowupSkeleton(): DailySection[] {
  return [
    { id: 'relief_signal', label: '这算是一个缓和信号', kind: 'paragraphs', paragraphs: [] },
    { id: 'history_thinking', label: '接下来 24–48 小时先看', kind: 'list', items: [] },
    { id: 'advice', label: '今晚先这样试', kind: 'paragraphs', paragraphs: [] },
    {
      id: 'deep_analysis',
      label: '如果出现这些情况',
      kind: 'paragraphs',
      paragraphs: [],
      hidden: true,
    },
  ]
}

/**
 * 只产出 section 骨架（id / label / kind / hidden）。
 * 正文由 ParentFacingCopy LLM 填充。
 */
export function composeDailySections(
  output: OrchestrationOutput,
  cards: DailyCards,
  _userText: string
): DailySection[] {
  if (output.inputType === 'risk_followup') {
    return composeRiskFollowupSkeleton()
  }

  if (!isHighConfidence(cards, output)) {
    return composeLowConfidenceSkeleton()
  }

  const sections = composeHighConfidenceSkeleton()
  if (output.inputType === 'ask_advice') {
    sections.push({
      id: 'deep_analysis',
      label: '这次要验证什么',
      kind: 'paragraphs',
      paragraphs: [],
      hidden: true,
    })
  }
  return sections
}

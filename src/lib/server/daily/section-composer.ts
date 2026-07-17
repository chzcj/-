import type { DailyCards, OrchestrationOutput } from '@/types/database'
import type { DailySection } from '@/types/daily-message'
import { THEORY_CARDS } from '@/lib/server/memory/deep-mechanism/theory-cards'

const THEORY_SOURCES: Record<string, string> = {
  attachment: 'Bowlby / Ainsworth 依恋研究',
  self_determination: 'Deci 与 Ryan 自我决定理论',
  family_systems: 'Bowen 家庭系统理论',
  family_communication: '家庭沟通研究',
  emotion_socialization: '情绪社会化研究',
  coercive_cycle: 'Patterson 强制循环理论',
  parenting_style: 'Baumrind 亲职风格研究',
  coparenting: '共同养育研究',
  sociocultural_scaffolding: 'Vygotsky 社会文化发展理论',
  stage_environment_fit: '阶段—环境匹配理论',
}

function isHighConfidence(cards: DailyCards, output: OrchestrationOutput): boolean {
  const rel = output.relationshipToExistingModel.type
  if (rel === 'insufficient') return false

  return (
    cards.confidenceMode !== 'low' &&
    output.routingDecision.frontResponseType !== 'one_key_followup'
  )
}

function composeHighConfidenceSkeleton(output: OrchestrationOutput): DailySection[] {
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
  const matched = output.retrievedContext.matchedMechanisms || []
  const theory = THEORY_CARDS.find((card) => matched.some((item) => item.includes(card.name)))
  if (theory) {
    sections.push({
      id: 'professional_perspective',
      label: '专业视角',
      kind: 'mixed',
      paragraphs: [],
      items: [],
      note: `相关理论：${theory.name}${THEORY_SOURCES[theory.id] ? `（${THEORY_SOURCES[theory.id]}）` : ''}。这不是诊断，而是帮助理解这次互动的一种视角。`,
    })
  }
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

  const sections = composeHighConfidenceSkeleton(output)
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

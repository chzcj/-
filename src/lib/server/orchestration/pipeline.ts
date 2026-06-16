import type {
  OrchestrationOutput,
  InputTypeLabel,
  InputClassification,
  FrontResponseType,
  MaturityLevel,
  EvidenceStrength,
  RoutingDecision,
  MemoryAction
} from '@/types/database'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { getCurrentMaturityState } from '@/lib/server/context/maturity'
import { createId } from '@/lib/storage/storageIds'
import { FORBIDDEN_PARENT_LABELS, SAFETY_KEYWORDS } from '@/lib/server/constitution'

/* ================================================================
   Orchestration Pipeline — 日常对话调度 Agent 编排
   7-Step Pipeline (调度 Agent SP §5)
   ================================================================ */

export interface OrchestrationInput {
  userText: string
  maturityLevel?: MaturityLevel
}

export async function runOrchestrationPipeline(input: OrchestrationInput): Promise<OrchestrationOutput> {
  const maturity = input.maturityLevel ? { level: input.maturityLevel } : getCurrentMaturityState()
  const retrievalPacket = await buildDailyDialogueRetrievalPacket(input.userText)
  const effectiveMaturity = retrievalPacket.contextMaturityLevel || maturity.level

  const inputType = classifyInputType(input.userText)
  const hasLabel = FORBIDDEN_PARENT_LABELS.some(label => input.userText.includes(label))
  const isSafety = SAFETY_KEYWORDS.some(kw => input.userText.includes(kw))

  if (isSafety) {
    return buildSafetyResponse(input, effectiveMaturity, retrievalPacket)
  }

  const canExplain = retrievalPacket.recommendedHandling.canExplainWithExistingModel
  const relationshipType = determineRelationship(input.userText, retrievalPacket, canExplain)

  const routingDecision = buildRoutingDecision(relationshipType, effectiveMaturity, canExplain)

  const memoryAction = buildMemoryAction(relationshipType, retrievalPacket)

  const frontResponse = buildFrontResponse(
    routingDecision.frontResponseType,
    input.userText,
    retrievalPacket,
    effectiveMaturity
  )

  return {
    agent: 'daily_dialogue_orchestration_agent',
    contextMaturityLevel: effectiveMaturity,
    inputType,
    decomposedInput: {
      facts: extractFacts(input.userText),
      childBehaviors: extractChildBehaviors(input.userText),
      childQuotes: [],
      parentQuotes: [input.userText],
      parentActions: [],
      triggerPoints: [],
      parentEmotions: [],
      parentEvaluations: hasLabel ? [input.userText] : [],
      parentAssumptions: [],
      parentGoals: [],
      missingInformation: canExplain ? [] : ['需要更多现场信息来判断']
    },
    retrievedContext: {
      relevantChildStructureModel: retrievalPacket.relevantChildStructureModels,
      relevantEntryEvidencePacks: retrievalPacket.supportingEvidence,
      relevantPastEvents: retrievalPacket.recentRelatedEvents,
      relevantPendingHypotheses: retrievalPacket.pendingHypotheses,
      relevantFamilyInteractionPatterns: [],
      recentDiagnosis: [],
      parentNarrativePattern: []
    },
    relationshipToExistingModel: {
      type: relationshipType,
      explanation: canExplain ? '当前输入可被已有画像解释' : '当前输入与已有画像关系不确定',
      confidence: canExplain ? 'medium' : 'low'
    },
    routingDecision,
    memoryAction,
    frontResponseDraft: frontResponse
  }
}

function classifyInputType(text: string): InputTypeLabel {
  const t = text.toLowerCase()
  if (t.includes('为什么') || t.includes('怎么') || t.includes('原因')) return 'ask_explanation'
  if (t.includes('我想') && (t.includes('说') || t.includes('话'))) return 'ask_rehearsal'
  if (t.includes('吵') || t.includes('发火') || t.includes('冲突')) return 'ask_conflict_review'
  if (t.includes('怎么办') || t.includes('应该')) return 'ask_advice'
  if (t.includes('太累') || t.includes('不想管') || t.includes('崩溃')) return 'emotional_vent'
  if (t.includes('是我') && (t.includes('逼') || t.includes('错') || t.includes('害'))) return 'self_blame'
  if (t.includes('我觉得你不')) return 'refute_old_judgment'
  if (t.includes('今天') || t.includes('最近') || t.includes('昨天')) return 'daily_observation'
  return 'new_fact'
}

function determineRelationship(
  text: string,
  retrieval: Awaited<ReturnType<typeof buildDailyDialogueRetrievalPacket>>,
  canExplain: boolean
): InputClassification {
  if (retrieval.recommendedHandling.shouldAskFollowup) return 'insufficient'
  if (canExplain) {
    const counterEvidenceSignals = ['没有检查', '没检查', '反而主动', '没有发火', '反而愿意', '主动拿题']
    if (counterEvidenceSignals.some(signal => text.includes(signal))) return 'counter_evidence'
    if ((text.includes('学校') || text.includes('老师') || text.includes('同学')) && (text.includes('不愿意说') || text.includes('不提') || text.includes('关门'))) {
      return 'new_mechanism_signal'
    }
    const isNew = text.includes('第一次') || text.includes('从没') || text.includes('最近开始')
    return isNew ? 'new_mechanism_signal' : 'old_mechanism_repetition'
  }
  return 'insufficient'
}

function buildRoutingDecision(
  relationship: InputClassification,
  maturity: MaturityLevel,
  canExplain: boolean
): RoutingDecision {
  let responseType: FrontResponseType = 'light_response'

  if (relationship === 'old_mechanism_repetition') {
    responseType = maturity >= 'L3' ? 'model_based_explanation' : 'one_key_followup'
  } else if (relationship === 'insufficient') {
    responseType = 'one_key_followup'
  } else if (relationship === 'new_mechanism_signal') {
    responseType = 'one_key_followup'
  } else if (relationship === 'counter_evidence') {
    responseType = 'profile_update_notice'
  }

  return {
    frontResponseType: responseType,
    needFollowup: relationship !== 'old_mechanism_repetition',
    followupQuestion: maturity === 'L0'
      ? '能不能先用语音说30秒以上，把最近最让你头疼的一个场景讲一讲？不要求说得多清楚，照当时发生的原话说就行。'
      : '',
    needMemoryWrite: true,
    needDeepDiagnosis: relationship === 'counter_evidence' || (relationship === 'new_mechanism_signal' && maturity >= 'L3'),
    needResynthesis: relationship === 'counter_evidence'
  }
}

function buildMemoryAction(
  relationship: InputClassification,
  retrieval: Awaited<ReturnType<typeof buildDailyDialogueRetrievalPacket>>
): MemoryAction {
  const doNotWrite = relationship === 'insufficient'
  return {
    writeRawFact: doNotWrite ? [] : ['本次对话内容'],
    writeGrowthRecord: doNotWrite ? [] : ['本次观察记录'],
    updatePendingHypothesis: [],
    updateStableProfile: relationship === 'old_mechanism_repetition' ? ['增强已有机制权重'] : [],
    updateFamilyInteractionPattern: [],
    updateWeeklyReportMaterial: doNotWrite ? [] : ['本周观察素材'],
    doNotWrite: doNotWrite ? ['信息不足，暂不写入长期记忆'] : []
  }
}

function buildSafetyResponse(
  input: OrchestrationInput,
  maturity: MaturityLevel,
  retrieval: Awaited<ReturnType<typeof buildDailyDialogueRetrievalPacket>>
): OrchestrationOutput {
  return {
    agent: 'daily_dialogue_orchestration_agent',
    contextMaturityLevel: maturity,
    inputType: 'high_risk_signal',
    decomposedInput: {
      facts: [], childBehaviors: [], childQuotes: [], parentQuotes: [input.userText],
      parentActions: [], triggerPoints: [], parentEmotions: [], parentEvaluations: [],
      parentAssumptions: [], parentGoals: [], missingInformation: []
    },
    retrievedContext: {
      relevantChildStructureModel: retrieval.relevantChildStructureModels,
      relevantEntryEvidencePacks: [],
      relevantPastEvents: [], relevantPendingHypotheses: [],
      relevantFamilyInteractionPatterns: [], recentDiagnosis: [], parentNarrativePattern: []
    },
    relationshipToExistingModel: { type: 'safety', explanation: '安全风险，停止常规分析', confidence: 'high' },
    routingDecision: {
      frontResponseType: 'safety_response',
      needFollowup: false, followupQuestion: '',
      needMemoryWrite: true, needDeepDiagnosis: false, needResynthesis: false
    },
    memoryAction: { writeRawFact: [], writeGrowthRecord: [], updatePendingHypothesis: [],
      updateStableProfile: [], updateFamilyInteractionPattern: [], updateWeeklyReportMaterial: [], doNotWrite: ['安全风险，只记录不分析'] },
    frontResponseDraft: '这个已经不能当普通亲子沟通问题处理。现在优先不是分析谁对谁错，而是先保证孩子安全。建议您马上联系线下可信亲友、学校老师或专业机构一起介入，不要一个人扛。'
  }
}

function extractFacts(text: string): string[] {
  const facts: string[] = []
  if (text.length > 10) facts.push(`家长输入：${text.slice(0, 100)}`)
  return facts
}

function extractChildBehaviors(text: string): string[] {
  const behaviors: string[] = []
  if (text.includes('拖')) behaviors.push('拖延')
  if (text.includes('手机')) behaviors.push('使用手机')
  if (text.includes('沉默') || text.includes('不说')) behaviors.push('沉默/回避沟通')
  if (text.includes('烦') || text.includes('发火')) behaviors.push('情绪烦躁')
  if (text.includes('没写') || text.includes('骗')) behaviors.push('隐瞒进度')
  return behaviors
}

function buildFrontResponse(
  responseType: FrontResponseType,
  userText: string,
  retrieval: Awaited<ReturnType<typeof buildDailyDialogueRetrievalPacket>>,
  maturity: MaturityLevel
): string {
  switch (responseType) {
    case 'model_based_explanation':
      if (retrieval.relevantChildStructureModels.length > 0) {
        return `这条和前面聊过的模式能对上。${retrieval.relevantChildStructureModels[0].slice(0, 200)}`
      }
      return '结合之前的材料看，这次更像之前那个模式又出现了。我会把它记进观察记录里。'
    case 'one_key_followup':
      if (maturity === 'L0') {
        return '现在这条信息还不足以判断孩子为什么这样。我不建议只靠这一句话下结论。我们最好先把几个关键场景补起来。能不能先用语音说30秒以上，把最近最让你头疼的一个场景讲一讲？照当时发生的原话说就行。'
      }
      if ((userText.includes('学校') || userText.includes('老师') || userText.includes('同学')) && (userText.includes('不愿意说') || userText.includes('不提') || userText.includes('关门'))) {
        return '这条像是一个新的学校场景线索，我先不把它硬套进原来的学习拖延模式。您可以先补一个最具体的变化：最近是从哪一天或哪次考试后，他开始不太提学校、老师或同学的？'
      }
      return '我收到这条了。不过现在还需要一个关键信息才能判断——您能再说一下当时具体是什么情况吗？比如是在检查作业之前还是之后发生的？'
    case 'light_response':
      return '收到，这条我先记到本周观察里。'
    case 'profile_update_notice':
      return '这条和前面的判断不完全一致，所以我不想硬套旧解释。我会把这个标记为需要重新验证的点。'
    default:
      return '收到，我会继续观察。'
  }
}

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
import { SAFETY_KEYWORDS } from '@/lib/server/constitution'
import type { TenantId } from '@/lib/server/memory/tenant'

/* ================================================================
   Orchestration Pipeline — 日常对话调度 Agent 编排
   7-Step Pipeline (调度 Agent SP §5)
   ================================================================ */

export interface OrchestrationInput {
  userText: string
  maturityLevel?: MaturityLevel
  tenant: TenantId
}

// 家长友好的「关联领域」标签（供前台展示，如观察页解读 chips）。
// 零 LLM、不暴露内部机制名/假设；纯关键词→主题映射。
const LINKED_AREA_RULES: Array<[RegExp, string]> = [
  [/作业|写作业|学习|做题|功课|成绩|背|预习|复习|数学|语文|英语|物理|化学|生物|历史|地理|政治|考试|测验|刷题|订正|错题|拖延|拖|磨蹭|卡住|卡在|不会写|不会做|不想写|笔记|默写/, '学习与作业'],
  [/手机|游戏|平板|刷|看视频|短视频|抖音|王者|电视|动画|直播|网/, '手机与娱乐'],
  [/烦|发火|哭|情绪|崩溃|生气|急躁|焦虑|害怕|委屈|难过|低落|暴躁|不耐烦|消沉/, '情绪状态'],
  [/睡|起床|作息|熬夜|赖床|午休|早起|睡不着|拖到很晚/, '作息节奏'],
  [/同学|老师|学校|班级|班里|校园|同桌|霸凌|被欺负|请假|旷课/, '学校与同伴'],
  [/说|聊|沟通|顶嘴|不理|沉默|吵|对话|催|吼|讲道理|不听|关门/, '亲子沟通'],
]

/** 从家长本轮输入派生家长可读的关联领域标签（替代失效的 entryName 提取）。 */
export function deriveLinkedAreas(text: string): string[] {
  const areas: string[] = []
  for (const [re, area] of LINKED_AREA_RULES) {
    if (re.test(text) && !areas.includes(area)) areas.push(area)
  }
  return areas.slice(0, 4)
}

export async function runOrchestrationPipeline(input: OrchestrationInput): Promise<OrchestrationOutput> {
  const maturity = input.maturityLevel ? { level: input.maturityLevel } : getCurrentMaturityState(input.tenant)
  const retrievalPacket = await buildDailyDialogueRetrievalPacket(input.userText, input.tenant)
  const effectiveMaturity = retrievalPacket.contextMaturityLevel || maturity.level

  const inputType = classifyInputType(input.userText)
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
    retrievedContext: {
      relevantChildStructureModel: retrievalPacket.relevantChildStructureModels,
      relevantEntryEvidencePacks: retrievalPacket.supportingEvidence,
      relevantPastEvents: retrievalPacket.recentRelatedEvents,
      relevantPendingHypotheses: retrievalPacket.pendingHypotheses,
      relevantFamilyInteractionPatterns: [],
      matchedMechanisms: retrievalPacket.matchedMechanisms,
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
      ? '先不用说得多准。我想先把场景听清楚，好区分他是"对这件事整体在回避"，还是"只对某个具体的点（某个人/某次事）敏感"——这两种后面处理不一样。能不能用语音说30秒以上，照当时发生的原话讲一个最近最头疼的场景？'
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
    retrievedContext: {
      relevantChildStructureModel: retrieval.relevantChildStructureModels,
      relevantEntryEvidencePacks: [],
      relevantPastEvents: [], relevantPendingHypotheses: [],
      relevantFamilyInteractionPatterns: [], matchedMechanisms: [], recentDiagnosis: [], parentNarrativePattern: []
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
        return '现在这一句还不够判断他为什么这样，我不想只靠这句下结论。我们先把场景讲清楚——我想先区分他是"对这件事整体在回避"，还是"只是某个具体的点（某位老师/某次考试/某个同学）变敏感了"，这两个方向后面不一样。能不能用语音说30秒以上，照当时发生的原话，讲一个最近最让你头疼的场景？'
      }
      if ((userText.includes('学校') || userText.includes('老师') || userText.includes('同学')) && (userText.includes('不愿意说') || userText.includes('不提') || userText.includes('关门'))) {
        return '这里不是要判断对错，而是想先区分两种可能：他是对"学校这件事"整体在回避，还是只是对某个具体的人或事（某位老师、某次考试、某个同学）变敏感了——这两个方向后面处理不一样。您凭印象说就行：最近是从哪一天或哪件事之后，他开始不太提学校的？'
      }
      return '这里我想先区分两种情况：他更像是在事情"还没开始前"就卡住进不去，还是"做到一半"遇到某个点才停下来——这两种后面处理方向不一样。您凭最近几次印象说就行，更像哪一种？'
    case 'light_response':
      return '收到，这条我先记到本周观察里。'
    case 'profile_update_notice':
      return '这条和前面的判断不完全一致，所以我不想硬套旧解释。我会把这个标记为需要重新验证的点。'
    default:
      return '收到，我会继续观察。'
  }
}

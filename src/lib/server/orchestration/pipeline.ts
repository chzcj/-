import type {
  OrchestrationOutput,
  InputTypeLabel,
  InputClassification,
  FrontResponseType,
  MaturityLevel,
  EvidenceStrength,
  RoutingDecision,
  MemoryAction,
  DailyCards,
  TurnEvent
} from '@/types/database'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { getCurrentMaturityState } from '@/lib/server/context/maturity'
import { createId } from '@/lib/storage/storageIds'
import { classifySafetyTier } from '@/lib/server/daily/safety-tier'
import { flattenParentUnderstanding } from '@/lib/server/memory/retrieval/router'
import type { TenantId } from '@/lib/server/memory/tenant'
import { getMergedParentInputHistory } from '@/lib/server/memory/database-manager'
import {
  canReuseCache,
  mergeIncrementalRetrievalPacket,
  setCachedRetrievalPacket,
} from '@/lib/server/memory/retrieval-session-cache'

import { buildDailyComponentPick } from '@/lib/server/daily/component-refiner'
import { humanizeBuiltJudgment, sanitizeForParent } from '@/lib/server/daily/profile-sanitize'

/* ================================================================
   Orchestration Pipeline — 日常对话调度 Agent 编排
   7-Step Pipeline (调度 Agent SP §5)
   ================================================================ */

export interface OrchestrationInput {
  userText: string
  maturityLevel?: MaturityLevel
  tenant: TenantId
  /** 同线程后续轮：前端会话提示；服务端仍必须用本轮输入重检索。 */
  warmTurn?: boolean
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

// 成熟度→分析卡档位（交付文档 4.5）：用 MaturityLevel 做证据深度的代理。
// L4 深度 / L3 标准 / L2 初版；L0/L1 理解还不足以成卡 → null（不展示）。
const TIER_BY_MATURITY: Record<MaturityLevel, '初版' | '标准' | '深度' | null> = {
  L0: null,
  L1: null,
  L2: '初版',
  L3: '标准',
  L4: '深度'
}

/**
 * 从同步的 OrchestrationOutput 装配日常对话页的家长可读卡片（交付文档 4.5）。
 * 零额外 LLM、纯函数：判断差量来自 relationshipToExistingModel.type，
 * 理解卡 reading 用 relevantChildStructureModel[0]（已被 /profile/result 当家长可读内容展示）。
 * 全部自然语言，不暴露字段/置信度/机制名（P0）。
 */
export function buildDailyCards(output: OrchestrationOutput, userText?: string): DailyCards {
  const cards: DailyCards = {}
  const rel = output.relationshipToExistingModel.type
  const ctx = output.retrievedContext
  const route = output.routingDecision

  if (rel === 'counter_evidence') {
    cards.judgmentDelta = '这条和之前的理解不太一致，我先把它标成需要重新看的点，不急着套旧解释。'
  } else if (rel === 'new_mechanism_signal') {
    cards.judgmentDelta = '这像是一个新的方向，和之前聊的不太一样，我先记下来，接下来多看一两次。'
  }

  const reading = ctx.relevantChildStructureModel?.[0]?.trim()
  const tier = TIER_BY_MATURITY[output.contextMaturityLevel]
  if (reading && tier) {
    cards.understandingCard = { tier, reading: reading.length > 280 ? `${reading.slice(0, 280)}…` : reading }
  }

  const evidenceSnippet =
    ctx.relevantEntryEvidencePacks?.[0]?.trim() ||
    ctx.relevantPastEvents?.[0]?.trim()
  if (evidenceSnippet && rel !== 'safety') {
    cards.evidenceBasis = evidenceSnippet.length > 220 ? `${evidenceSnippet.slice(0, 220)}…` : evidenceSnippet
  }

  cards.confidenceMode =
    rel === 'insufficient' ||
    output.relationshipToExistingModel.confidence === 'low' ||
    (route.needFollowup &&
      rel !== 'counter_evidence' &&
      rel !== 'new_mechanism_signal' &&
      route.frontResponseType === 'one_key_followup')
      ? 'low'
      : 'high'

  if (route.needFollowup || route.frontResponseType === 'one_key_followup') {
    const question = route.followupQuestion?.trim()
    if (question) {
      cards.followUp = { question, distinction: extractDistinction(question) }
    } else if (rel === 'insufficient') {
      cards.followUp = {
        question: '想先确认一个现场细节，好区分两种可能——您凭最近几次印象说就行。',
        distinction: '整体回避 vs 某个具体点变敏感',
      }
    } else if (rel === 'new_mechanism_signal') {
      cards.followUp = {
        question: '这像是新出现的情况。最近一次和之前最不一样的地方是什么？',
        distinction: '偶发波动 vs 开始反复出现',
      }
    } else if (route.needFollowup) {
      cards.followUp = {
        question: '想再确认一个细节，好把判断收得更准——您凭最近几次印象说就行。',
        distinction: '表面行为 vs 触发前的状态',
      }
    }
  }

  if (output.inputType === 'ask_advice') {
    cards.adviceSeed =
      ctx.relevantFamilyInteractionPatterns?.[0] ||
      ctx.relevantChildStructureModel?.[1] ||
      '先选一个你们家今晚做得到的小动作，试一次再看孩子反应。'
  } else if (
    route.frontResponseType === 'model_based_explanation' ||
    route.frontResponseType === 'advice_from_dossier'
  ) {
    cards.adviceSeed =
      ctx.relevantFamilyInteractionPatterns?.[0] ||
      ctx.relevantChildStructureModel?.[1] ||
      undefined
  }

  if (route.needDeepDiagnosis || rel === 'counter_evidence' || rel === 'new_mechanism_signal') {
    const points: string[] = []
    if (ctx.relevantPendingHypotheses?.[0]) {
      points.push(`还在验证：${truncateParentText(ctx.relevantPendingHypotheses[0], 120)}`)
    }
    if (ctx.relevantPastEvents?.[1] || ctx.relevantPastEvents?.[0]) {
      const evt = ctx.relevantPastEvents[1] || ctx.relevantPastEvents[0]
      points.push(`相关片段：${truncateParentText(evt, 120)}`)
    }
    if (output.relationshipToExistingModel.explanation && rel !== 'safety') {
      const exp = sanitizeForParent(output.relationshipToExistingModel.explanation)
      if (exp) points.push(truncateParentText(exp, 100))
    }
    if (points.length) {
      cards.deepAnalysis = {
        title: rel === 'counter_evidence' ? '为什么这条值得重新看' : '结合已有材料，这轮多看的点',
        points: points.slice(0, 4),
      }
    }
  }

  const baseCards = { ...cards }
  const linked = userText ? deriveLinkedAreas(userText) : []
  const { candidates, rulePick } = buildDailyComponentPick(output, baseCards, linked)
  cards.activeComponents = rulePick

  return cards
}

function truncateParentText(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** 从追问文案中提取「区分 X 还是 Y」提示（对齐 dailyDialogueOrchestration SP） */
function extractDistinction(question: string): string | undefined {
  const m = question.match(/区分[^？?。]+[还是／/][^？?。]+/)
  return m?.[0]
}

/**
 * 装配每轮 TurnEvent 输入+输出快照（交付文档 7.2）。纯函数，从同步 output 直接取数，
 * 零额外查询/LLM。按 traceId 持久化后可复现「家长说这句话时喂给 Agent 的上下文 + Agent 产出」。
 */
export function buildTurnEvent(args: {
  output: OrchestrationOutput
  traceId: string
  tenant: TenantId
  userMessage: string
  assistantReply: string
  linkedAreas: string[]
  mode?: string
  sections?: import('@/types/daily-message').DailySection[]
  actions?: import('@/types/daily-message').DailyAction[]
}): TurnEvent {
  const now = new Date().toISOString()
  const sectionIds = args.sections?.map((s) => s.id) || []
  return {
    turnId: createId('turn'),
    traceId: args.traceId,
    familyId: args.tenant.familyId,
    childId: args.tenant.childId,
    mode: args.mode || 'daily_dialogue',
    userMessage: args.userMessage,
    assistantReply: args.assistantReply,
    maturityLevel: args.output.contextMaturityLevel,
    inputType: args.output.inputType,
    relationship: args.output.relationshipToExistingModel,
    retrievedContextSnapshot: args.output.retrievedContext,
    routingDecisionSnapshot: args.output.routingDecision,
    memoryActionSnapshot: args.output.memoryAction,
    specializedContextPackSnapshot:
      sectionIds.length > 0
        ? { sectionIds, sections: args.sections, actions: args.actions }
        : undefined,
    linkedAreas: args.linkedAreas,
    recentTurnsSnapshot: [],
    knowledgeContextSnapshot: null,
    createdAt: now
  }
}

/**
 * v4：构建上下文增强的检索 query。
 * 主信号 = 本轮 userText（权重最高）；
 * 次信号 = 近 3 轮家长输入的主题关键词（帮助向量检索召回领域相关 atom）。
 * 不拼接历史全文（避免噪声），只提取关键词。
 */
async function buildContextEnrichedQuery(userText: string, tenant: TenantId): Promise<string> {
  try {
    const recent = await getMergedParentInputHistory(tenant, 3)
    if (recent.length <= 1) return userText
    // 取近 3 轮（不含本轮），提取每轮前 30 字作为主题线索
    const contextSnippets = recent
      .slice(0, 2)
      .map(r => (r.text || '').slice(0, 30))
      .filter(Boolean)
    if (contextSnippets.length === 0) return userText
    return `${userText} 上下文：${contextSnippets.join('；')}`
  } catch {
    return userText
  }
}

export async function runOrchestrationPipeline(input: OrchestrationInput): Promise<OrchestrationOutput> {
  const maturity = input.maturityLevel ? { level: input.maturityLevel } : getCurrentMaturityState(input.tenant)

  // 每轮使用当前输入重跑向量检索。warmTurn 只表示前端线程状态，绝不能成为
  // 跳过记忆搜索的开关，否则对话话题切换后会锁死首轮证据。
  // v4：session cache + 漂移检测——warmTurn 且话题未漂移时复用首轮 packet（省检索成本），
  // 话题漂移（cos sim < 0.6）时失效 cache 做全量检索。
  // v4：检索 query 拼接近期上下文关键词，让向量检索能召回领域相关 atom
  const retrievalQuery = await buildContextEnrichedQuery(input.userText, input.tenant)
  let retrievalPacket: Awaited<ReturnType<typeof buildDailyDialogueRetrievalPacket>>
  if (input.warmTurn) {
    const { reuse, cached, currentEmbedding } = await canReuseCache(input.tenant, retrievalQuery)
    if (reuse && cached) {
      retrievalPacket = await mergeIncrementalRetrievalPacket(cached.packet, input.userText, input.tenant)
    } else {
      retrievalPacket = await buildDailyDialogueRetrievalPacket(retrievalQuery, input.tenant)
      // 存储 cache（用本轮 query embedding，供下一轮漂移检测）
      if (currentEmbedding) {
        setCachedRetrievalPacket(input.tenant, retrievalPacket, currentEmbedding)
      }
    }
  } else {
    retrievalPacket = await buildDailyDialogueRetrievalPacket(retrievalQuery, input.tenant)
  }
  const effectiveMaturity = retrievalPacket.contextMaturityLevel || maturity.level

  const inputType = classifyInputType(input.userText)
  const safetyTier = classifySafetyTier(input.userText)

  if (safetyTier === 'critical' || safetyTier === 'elevated') {
    return buildSafetyResponse(input, effectiveMaturity, retrievalPacket, safetyTier)
  }

  const canExplain = retrievalPacket.recommendedHandling.canExplainWithExistingModel
  const relationshipType = determineRelationship(input.userText, retrievalPacket, canExplain, inputType)

  const routingDecision = buildRoutingDecision(relationshipType, effectiveMaturity, canExplain, inputType)

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
      relevantEntryEvidencePacks:
        retrievalPacket.entryEvidencePackSummaries?.length
          ? retrievalPacket.entryEvidencePackSummaries
          : retrievalPacket.supportingEvidence,
      relevantPastEvents: retrievalPacket.recentRelatedEvents,
      relevantPendingHypotheses: retrievalPacket.pendingHypotheses,
      relevantFamilyInteractionPatterns: retrievalPacket.familyInteractionPatterns,
      matchedMechanisms: retrievalPacket.matchedMechanisms,
      // v4：补 dossierSlice + domainAtomFacts（之前 orchestration pipeline 漏传）
      dossierSlice: retrievalPacket.dossierSlice || [],
      domainAtomFacts: retrievalPacket.domainAtomFacts || [],
      recentDiagnosis: [],
      parentNarrativePattern: flattenParentUnderstanding(retrievalPacket.parentNarrativePattern || {}),
      childQuotes: retrievalPacket.childQuotes,
      parentVerbatimSnippets: retrievalPacket.parentVerbatimSnippets || [],
      entryFacts: retrievalPacket.entryFacts,
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
  if (classifySafetyTier(text) === 'relief_followup') return 'risk_followup'

  const t = text.toLowerCase()
  if (
    t.includes('怎么跟他说') ||
    t.includes('该怎么跟他说') ||
    t.includes('该怎么和他说') ||
    t.includes('今晚到底该怎么') ||
    (t.includes('今晚') && t.includes('怎么') && t.includes('说'))
  ) {
    return 'ask_advice'
  }
  if (t.includes('怎么办') || t.includes('应该') || t.includes('下一步建议') || t.includes('给我下一步')) {
    return 'ask_advice'
  }
  if (t.includes('为什么') || (t.includes('怎么') && t.includes('原因'))) return 'ask_explanation'
  if (t.includes('我想') && (t.includes('说') || t.includes('话'))) return 'ask_rehearsal'
  if (t.includes('吵') || t.includes('发火') || t.includes('冲突')) return 'ask_conflict_review'
  if (t.includes('太累') || t.includes('不想管') || t.includes('崩溃')) return 'emotional_vent'
  if (t.includes('是我') && (t.includes('逼') || t.includes('错') || t.includes('害'))) return 'self_blame'
  if (t.includes('我觉得你不')) return 'refute_old_judgment'
  if (t.includes('今天') || t.includes('最近') || t.includes('昨天')) return 'daily_observation'
  return 'new_fact'
}

function determineRelationship(
  text: string,
  retrieval: Awaited<ReturnType<typeof buildDailyDialogueRetrievalPacket>>,
  canExplain: boolean,
  inputType: InputTypeLabel
): InputClassification {
  if (retrieval.recommendedHandling.shouldAskFollowup) return 'insufficient'
  if (canExplain) {
    if (inputType === 'ask_advice' || inputType === 'ask_rehearsal') {
      return 'old_mechanism_repetition'
    }
    const counterEvidenceSignals = [
      '没有检查', '没检查', '反而主动', '没有发火', '反而愿意', '主动拿题',
      '没有吵', '居然没有', '主动拿', '主动把', '主动来', '自己来问', '话多了一点', '明显话多',
      '我只问', '我没有安排', '比以前', '顺一些',
    ]
    if (counterEvidenceSignals.some(signal => text.includes(signal))) return 'counter_evidence'
    const schoolAvoidance =
      (text.includes('学校') || text.includes('老师') || text.includes('同学')) &&
      (text.includes('不愿意说') || text.includes('不愿说') || text.includes('不提') || text.includes('不说学校'))
    if (schoolAvoidance) {
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
  canExplain: boolean,
  inputType: InputTypeLabel
): RoutingDecision {
  let responseType: FrontResponseType = 'light_response'

  if (relationship === 'old_mechanism_repetition') {
    if (inputType === 'ask_advice' && canExplain) {
      responseType = 'advice_from_dossier'
    } else {
      responseType = maturity >= 'L3' ? 'model_based_explanation' : 'one_key_followup'
    }
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
  retrieval: Awaited<ReturnType<typeof buildDailyDialogueRetrievalPacket>>,
  tier: 'critical' | 'elevated' = 'critical'
): OrchestrationOutput {
  const draft =
    tier === 'critical'
      ? '这个已经不能当普通亲子沟通问题处理。现在优先不是分析谁对谁错，而是先保证孩子安全。建议您马上联系线下可信亲友、学校老师或专业机构一起介入，不要一个人扛。'
      : '我注意到你描述的情况需要更谨慎对待。现在优先不是分析谁对谁错，而是先保证孩子安全，并尽快联系线下可信的亲友、学校老师或专业人员一起介入，不要一个人扛。'

  return {
    agent: 'daily_dialogue_orchestration_agent',
    contextMaturityLevel: maturity,
    inputType: 'high_risk_signal',
    retrievedContext: {
      relevantChildStructureModel: retrieval.relevantChildStructureModels,
      relevantEntryEvidencePacks: [],
      relevantPastEvents: [], relevantPendingHypotheses: [],
      relevantFamilyInteractionPatterns: [], matchedMechanisms: [], recentDiagnosis: [], parentNarrativePattern: [], childQuotes: [], entryFacts: []
    },
    relationshipToExistingModel: { type: 'safety', explanation: '安全风险，停止常规分析', confidence: 'high' },
    routingDecision: {
      frontResponseType: 'safety_response',
      needFollowup: false, followupQuestion: '',
      needMemoryWrite: true, needDeepDiagnosis: false, needResynthesis: false
    },
    memoryAction: { writeRawFact: [], writeGrowthRecord: [], updatePendingHypothesis: [],
      updateStableProfile: [], updateFamilyInteractionPattern: [], updateWeeklyReportMaterial: [], doNotWrite: ['安全风险，只记录不分析'] },
    frontResponseDraft: draft
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
    case 'advice_from_dossier':
      if (retrieval.relevantChildStructureModels.length > 0) {
        const readable = sanitizeForParent(retrieval.relevantChildStructureModels[0])
        if (readable) {
          return `这条和前面聊过的模式能对上。${readable.slice(0, 120)}`
        }
      }
      return '结合前面的记录看，这次更像之前那个模式又出现了。我会把它记进观察记录里。'
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

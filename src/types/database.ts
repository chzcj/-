export type MaturityLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'

export type EntryName =
  | 'learning_homework'
  | 'daily_rhythm_phone'
  | 'parent_child_communication'
  | 'emotional_stress'
  | 'relationship_environment'

export type EntryCoverage = 'missing' | 'partial' | 'sufficient' | 'strong'
export type EvidenceStrength = 'low' | 'medium' | 'high'
export type HypothesisWeight = 'very_low' | 'low' | 'medium' | 'medium_high' | 'high'
export type EntryPackStatus =
  | 'not_started'
  | 'initial_input_received'
  | 'followup_needed'
  | 'evidence_pack_ready'
  | 'evidence_pack_updated'
  | 'insufficient'

export type DiagnosisLevel =
  | 'direction'
  | 'candidate'
  | 'stage'
  | 'core_profile'
  | 'stable_mechanism'

export type InteractionCycleStatus = 'candidate' | 'stage' | 'stable'

export type InputClassification =
  | 'old_mechanism_repetition'
  | 'new_supporting_evidence'
  | 'pending_hypothesis_evidence'
  | 'counter_evidence'
  | 'new_mechanism_signal'
  | 'short_term_fluctuation'
  | 'pure_record'
  | 'needs_prehearsal'
  | 'needs_conflict_review'
  | 'insufficient'
  | 'safety'

export type FrontResponseType =
  | 'light_response'
  | 'model_based_explanation'
  | 'advice_from_dossier'
  | 'one_key_followup'
  | 'communication_prehearsal'
  | 'conflict_review'
  | 'profile_update_notice'
  | 'trigger_deep_diagnosis'
  | 'trigger_resynthesis'
  | 'safety_response'

export type DiagnosisTaskType =
  | 'initial_model'
  | 'profile_build'
  | 'stage_diagnosis'
  | 'daily_event_explanation'
  | 'model_update'
  | 'conflict_review'
  | 'communication_prediction'

export type SourceInputType = 'voice' | 'text' | 'uploaded_material' | 'followup_answer'

export type InputTypeLabel =
  | 'new_fact'
  | 'daily_observation'
  | 'ask_explanation'
  | 'ask_rehearsal'
  | 'ask_conflict_review'
  | 'refute_old_judgment'
  | 'supplement_evidence'
  | 'emotional_vent'
  | 'self_blame'
  | 'ask_advice'
  | 'ask_summary'
  | 'upload_material'
  | 'high_risk_signal'
  | 'risk_followup'
  | 'casual_chat'

export type DailyMemoryImpact = 'increase_strength' | 'decrease_strength' | 'narrow_scope' | 'new_mechanism' | 'no_change' | 'safety_record'

export type ChildProfileStatus = 'stable' | 'stage_judgment' | 'pending'

/* ================================================================
   v4 基础类型：证据引用 / 三角化事实 / 机制关系边 / 家庭 Agent persona
   ================================================================ */
export type EvidenceSource = 'child_quote' | 'parent_statement' | 'behavior_observation' | 'entry_evidence' | 'transcript'

export type EpistemicStatus = 'observed' | 'reported' | 'derived' | 'inferred' | 'hypothesized' | 'expert_confirmed'

export interface EvidenceRef {
  /** 指向 fact_atoms.atom_id 或 evidence_episodes.episode_id */
  evidenceId: string
  /** 0-1，该证据对当前判断的贡献 */
  weight: number
  /** 原话片段（人类可读） */
  quote: string
  source: EvidenceSource
  /** 业务观察时间（非写入时间） */
  observedAt?: string
  epistemicStatus: EpistemicStatus
}

export interface TriangulatedFact {
  factId: string
  content: string
  sources: EvidenceSource[]
  sourceCount: number
  /** 来源独立性 0-1（不同时间/不同观察者/不同模态更独立） */
  independenceScore: number
  /** 硬公式：单源≤0.5 / 双源 0.6-0.7 / 三源≥0.8 / 四源≥0.95 */
  confidence: number
  evidenceRefs: EvidenceRef[]
}

export type MechanismRelationType = 'competesWith' | 'reinforces' | 'upstreamOf' | 'explainsSameBehavior' | 'contradicts'

export interface MechanismEdge {
  fromMechanismId: string
  toMechanismId: string
  relation: MechanismRelationType
  /** 0-1，关系强度 */
  weight: number
  evidenceRefs: EvidenceRef[]
  /** 在哪个场景下成立 */
  sceneNote?: string
}

export interface FamilyAgentPersona {
  familyId: string
  parentTraits: {
    anxietyLevel: number
    controlTendency: number
    reflectivity: number
  }
  childTraits: {
    ageStage: string
    temperament: string
  }
  familyClimate: {
    conflictFrequency: number
    supportLevel: number
  }
  toneCalibration: 'gentle' | 'direct' | 'analytical'
  questionStrategy: 'probe_feeling' | 'probe_behavior' | 'probe_context'
  updatedAt: string
  version: number
}

/* ================================================================
   L1: RawMaterial Layer
   ================================================================ */
export interface RawMaterial {
  materialId: string
  familyId: string
  childId: string
  source: SourceInputType
  entry?: EntryName
  conversationId?: string
  rawText: string
  speaker: 'parent' | 'child' | 'teacher' | 'other'
  emotionTag?: string
  qualityNote?: 'clear' | 'fuzzy' | 'emotional' | 'label_heavy' | 'lacks_fact' | 'possibly_exaggerated'
  linkedChildId?: string
  attachmentUrls?: string[]
  timestamp: string
  createdAt: string
}

/* ================================================================
   L2: CleanedFact Layer
   ================================================================ */
export interface CleanedFact {
  factId: string
  familyId: string
  childId: string
  sourceRawIds: string[]
  scene: string
  event: string
  parentAction?: string
  childReaction?: string
  childQuote?: string
  parentQuote?: string
  triggerPoint?: string
  timeNode?: string
  placeContext?: string
  parentEmotion?: string
  parentEvaluation: string
  parentAssumption?: string
  parentGoal?: string
  evidenceStrength: EvidenceStrength
  missingInfo: string[]
  crossEntrySignals: string[]
  createdAt: string
  updatedAt: string
}

/* ================================================================
   L3: EntryEvidencePack Layer
   ================================================================ */
export interface EntryCandidateMechanism {
  mechanismName: string
  description: string
  supportingEvidence: string[]
  evidenceStrength: EvidenceStrength
  counterEvidenceOrGap: string[]
  needsCrossEntryVerification: boolean
  possibleProtectiveFunction: string
  doNotPromoteToStableProfileYet: boolean
}

export interface EntryEvidenceUnit {
  scene: string
  trigger: string
  parentAction: string
  childReaction: string
  childQuote: string
  parentInterpretation: string
  possibleFunction: string
  evidenceStrength: EvidenceStrength
  source: SourceInputType
  crossEntryLinks: string[]
}

export interface EntryFollowupCandidate {
  question: string
  purpose: string
  targetMechanism: string
  whyItMatters: string
  priority: 'high' | 'medium' | 'low'
}

export interface EntryEvidencePack {
  packId: string
  familyId: string
  childId: string
  entryName: EntryName
  entryStatus: EntryPackStatus
  rawInputSummary: string
  decomposedInput: {
    verifiableFacts: string[]
    childBehaviors: string[]
    parentActions: string[]
    triggerPoints: string[]
    parentEvaluations: string[]
    parentGoals: string[]
    missingInformation: string[]
    /* ---- 可选维度字段（2026-07 增补）：family/communication 模块 prompt 一直在问，
       但抽取 schema 无字段承接，信息在结构化时被稀释。全部可选、只在家长明确提及时填。 ---- */
    /** 试过的教育方法及其效果配对（如"报补习班→两次都半途而废"） */
    triedMethods?: Array<{ method: string; effect: string }>
    /** 夫妻/照护者之间的教育分歧 */
    parentDisagreements?: string[]
    /** 父母陪伴时长与节律（如"爸爸常年出差，妈妈全职陪读"） */
    companionshipTime?: string
    /** 孩子兴趣特长 */
    childInterests?: string[]
    /** 分科目学习状态（如"数学下滑、语文稳定"） */
    subjectStates?: Array<{ subject: string; state: string }>
  }
  candidateMechanisms: EntryCandidateMechanism[]
  evidenceUnits: EntryEvidenceUnit[]
  followupCandidates: EntryFollowupCandidate[]
  crossEntrySignals: string[]
  handoffToSummaryAgent: {
    mostImportantEvidence: string[]
    mostLikelyLocalMechanisms: string[]
    mostImportantGaps: string[]
    possibleLinksToOtherEntries: string[]
    warnings: string[]
  }
  alreadyAskedQuestions: string[]
  createdAt: string
  updatedAt: string
}

/* ================================================================
   L4: CrossEntryEvidenceNetwork Layer
   ================================================================ */
export interface CrossEntryEvidence {
  evidenceId: string
  sourceEntries: EntryName[]
  surfaceBehaviors: string[]
  triggerPoints: string[]
  parentActions: string[]
  childReactions: string[]
  childQuotes: string[]
  parentInterpretations: string[]
  possibleSharedFunction: string
  evidenceStrength: EvidenceStrength
  notes: string
}

export interface MechanismScore {
  evidenceSpecificity: number
  crossEntryRepetition: number
  explanatoryCoverage: number
  familyChainCompleteness: number
  protectiveFunctionClarity: number
  counterInfoCompatibility: number
  verifiability: number
  familySpecificity: number
}

export interface FamilyInteractionChain {
  parentTriggerAction: string
  parentReasonableGoal: string
  childReception: string
  childReaction: string
  parentSecondInterpretation: string
  parentReinforcementAction: string
  childFurtherStrategy: string
  longTermEffect: string
}

export type MechanismType =
  | 'core_candidate'
  | 'stage_candidate'
  | 'local_candidate'
  | 'pending_hypothesis'
  | 'unsupported'

export type EcosystemLayer = 'micro' | 'meso' | 'exo' | 'macro' | 'chrono'

export interface CandidateMechanism {
  mechanismName: string
  mechanismType: MechanismType
  description: string
  supportedByEntries: EntryName[]
  supportingEvidence: string[]
  /** v4：EvidenceRef id 化引用，替代 supportingEvidence 的 string[] */
  evidenceRefs?: EvidenceRef[]
  explainedBehaviors: string[]
  possibleProtectiveFunction: string
  familyInteractionChain: FamilyInteractionChain
  scores: MechanismScore
  overallStrength: EvidenceStrength
  /** v4：0-1 数值置信度，替代 overallStrength 三档 */
  overallStrengthScore?: number
  applicableScope: string
  /** v4：从 dossier 层下放到 mechanism 层的场景配比 */
  sceneReadings?: import('./family-understanding-dossier').DossierSceneReading[]
  /** v4：机制间关系边（competesWith / reinforces / upstreamOf / 等） */
  relatedMechanismIds?: MechanismEdge[]
  missingEvidence: string[]
  possibleAlternativeExplanations: string[]
  shouldPromoteToDiagnosis: boolean
  ecosystemLayer?: EcosystemLayer
  theoryCardId?: string
}

export interface CrossEntryEvidenceNetwork {
  networkId: string
  familyId: string
  childId: string
  maturityLevel: MaturityLevel
  inputCoverage: Record<EntryName, EntryCoverage>
  crossEntryEvidenceMap: CrossEntryEvidence[]
  candidateMechanismMatrix: CandidateMechanism[]
  /** synthesis 草稿 vs deep_mechanism 复核后；用于竞态可观测与读侧优先级 */
  mechanismLayerSource?: 'synthesis' | 'deep_mechanism'
  createdAt: string
  updatedAt: string
}

/* ================================================================
   L5: ChildStructureModel Layer
   ================================================================ */
export interface ConditionalProfile {
  profileId: string
  familyId: string
  childId: string
  status: ChildProfileStatus
  triggerScene: string
  childTendency: string
  notBecause: string
  likelyBecause: string
  parentInterventionEffect: string
  protectiveStrategy: string
  evidenceSources: string[]
  strength: EvidenceStrength
  boundaries: string[]
  version: number
  previousVersionId?: string
  updateReason?: string
  supersededAt?: string
  createdAt: string
  updatedAt: string
}

export interface ChildStructureModel {
  modelId: string
  familyId: string
  childId: string
  maturityLevel: MaturityLevel
  primaryConditionalProfile: ConditionalProfile | null
  secondaryConditionalProfiles: ConditionalProfile[]
  dominantProtectiveStrategies: string[]
  // likelyFamilyInteractionPatterns 已删（dead write：retrieval 统一从 L7 FamilyInteractionCycle 拼，不读此字段）
  learningSituationHypotheses: string[]
  emotionalPressureHypotheses: string[]
  trustAndCommunicationHypotheses: string[]
  boundaries: string[]
  createdAt: string
  updatedAt: string
}

/* ================================================================
   L6: PendingHypothesis Layer
   ================================================================ */
export interface PendingHypothesis {
  hypothesisId: string
  familyId: string
  childId: string
  hypothesis: string
  triggerSource: string
  supportingEvidence: string[]
  /** v4：EvidenceRef id 化引用，替代 supportingEvidence 的 string[] */
  supportingEvidenceRefs?: EvidenceRef[]
  missingEvidence: string[]
  verificationQuestions: string[]
  possibleCounterEvidence: string[]
  /** v4：反证证据 id 化引用 */
  contradictingEvidenceRefs?: EvidenceRef[]
  weight: HypothesisWeight
  /** v4：贝叶斯先验概率 0-1 */
  prior?: number
  /** v4：似然 0-1 */
  likelihood?: number
  /** v4：后验 = prior × likelihood / Σ */
  posterior?: number
  /** v4：需什么证据区分此假设与竞争假设 */
  distinguishingEvidence?: string
  applicableScenes: string[]
  status: 'pending' | 'supported' | 'weakened' | 'resolved' | 'dismissed'
  retrievalTags: string[]
  createdAt: string
  updatedAt: string
}

/* ================================================================
   L7: FamilyInteractionCycle Layer
   ================================================================ */
export interface FamilyInteractionCycle {
  cycleId: string
  familyId: string
  childId: string
  cycleName: string
  parentTriggerAction: string
  parentReasonableGoal: string
  childReception: string
  childReaction: string
  parentSecondInterpretation: string
  parentReinforcementAction: string
  childFurtherStrategy: string
  longTermEffect: string
  supportingEvidence: string[]
  sceneScope: string
  status: InteractionCycleStatus
  version: number
  previousVersionId?: string
  createdAt: string
  updatedAt: string
}

/* ================================================================
   L8: ParentNarrativePattern Layer
   ================================================================ */
export interface ParentNarrativePattern {
  patternId: string
  familyId: string
  childId: string
  observations: string[]
  labelTendency: 'frequent' | 'occasional' | 'rare'
  moralizeTendency: 'frequent' | 'occasional' | 'rare'
  effortEmphasis: 'frequent' | 'occasional' | 'rare'
  selfBlameTendency: 'frequent' | 'occasional' | 'rare'
  correctionReceptivity: 'high' | 'medium' | 'low'
  factProvisionAbility: 'high' | 'medium' | 'low'
  interactionImplications: string[]
  createdAt: string
  updatedAt: string
}

/* ================================================================
   L9: DailyInteractionUpdate Layer
   ================================================================ */
export interface DailyInteractionUpdate {
  updateId: string
  familyId: string
  childId: string
  newInput: string
  classification: InputClassification
  matchedMechanisms: string[]
  timestamp: string
  createdAt: string
  sourceEventId?: string  // traceId：贯穿 userMessage→memory write→episode→job 的可追溯链路
  /** journal = 家长随笔（画像手账 feed） */
  sourceKind?: 'journal' | 'daily'
}

/* ================================================================
   L10: RetrievalIndex Layer
   ================================================================ */
export interface RetrievalIndex {
  indexId: string
  familyId: string
  childId: string
  linkedItemId: string
  linkedItemLayer: string
  sceneTags: string[]
  mechanismTags: string[]
  evidenceStrengthTag: EvidenceStrength
  timeTags: string[]
  createdAt: string
}

/* ================================================================
   Synthesis Output (多入口综合建模 Agent 输出)
   ================================================================ */
export interface SynthesisOutput {
  agent: 'multi_entry_synthesis_modeling_agent'
  contextMaturityLevel: MaturityLevel
  inputCoverage: Record<EntryName, EntryCoverage>
  crossEntryEvidenceMap: CrossEntryEvidence[]
  candidateMechanismMatrix: CandidateMechanism[]
  childStructureModelDraft: {
    primaryConditionalProfile: string
    secondaryConditionalProfiles: string[]
    dominantProtectiveStrategies: string[]
    likelyFamilyInteractionPatterns: string[]
    learningSituationHypotheses: string[]
    emotionalPressureHypotheses: string[]
    trustAndCommunicationHypotheses: string[]
    boundaries: string[]
  }
  diagnosisHandoffPackage: DiagnosisHandoffPackage
  memoryWriteSuggestions: MemoryWriteSuggestion
}

export interface DiagnosisHandoffPackage {
  recommendedDiagnosisStrength: DiagnosisLevel
  mainMechanismToExplain: string
  keyEvidencePath: string[]
  parentMisreadingsToCorrect: string[]
  childPerspectiveToTranslate: string[]
  doNotOverstate: string[]
  mustKeepBoundary: string[]
  stillNeedToVerify: string[]
}

export interface MemoryWriteSuggestion {
  stableProfileCandidates: string[]
  stageJudgmentCandidates: string[]
  pendingHypotheses: string[]
  familyInteractionCandidates: string[]
  factsToStore: string[]
  oldJudgmentsToUpdate: string[]
  retrievalTags: string[]
}

/* ================================================================
   Diagnosis Output (深层诊断 Agent 输出)
   ================================================================ */
export interface DiagnosisOutput {
  diagnosisAgent: 'deep_diagnosis_agent'
  diagnosisTaskType: DiagnosisTaskType
  contextMaturityLevel: MaturityLevel
  surfaceProblem: string
  parentSurfaceJudgment: string
  lowMisjudgmentFacts: string[]
  crossSceneEvidencePaths: string[]
  mainMechanismCandidates: DiagnosisMechanismCandidate[]
  primaryMechanismChain: PrimaryMechanismChain
  childSelfProtection: ChildSelfProtection
  familyInteractionLoop: DiagnosisInteractionLoop
  secondMeConditionalProfile: string[]
  parentMisjudgmentCorrection: string
  needsFurtherVerification: string[]
  handoffToMemoryAgent: MemoryHandoff
}

export interface DiagnosisMechanismCandidate {
  mechanismName: string
  description: string
  supportingEvidence: string[]
  explainsBehaviors: string[]
  evidenceStrength: EvidenceStrength
  diagnosisLevel: DiagnosisLevel
  missingEvidence: string[]
  boundary: string
}

export interface PrimaryMechanismChain {
  parentAction: string
  childReception: string
  childProtectionStrategy: string
  parentSecondInterpretation: string
  reinforcingAction: string
  shortTermFunction: string
  longTermCost: string
}

export interface ChildSelfProtection {
  surfaceBehavior: string[]
  protectingWhat: string[]
  whyCannotExpressDirectly: string
  immatureButFunctionalStrategy: string
}

export interface DiagnosisInteractionLoop {
  patternName: string
  loopSteps: string[]
  sceneScope: string
  evidence: string[]
  status: InteractionCycleStatus
}

export interface MemoryHandoff {
  stableProfileCandidates: string[]
  stageJudgments: string[]
  pendingHypotheses: string[]
  evidenceToStore: string[]
  patternsToUpdate: string[]
}

/* ================================================================
   Orchestration Output (日常对话调度 Agent 输出)
   ================================================================ */
export interface OrchestrationOutput {
  agent: 'daily_dialogue_orchestration_agent'
  contextMaturityLevel: MaturityLevel
  inputType: InputTypeLabel
  retrievedContext: RetrievedContext
  relationshipToExistingModel: {
    type: InputClassification
    explanation: string
    confidence: EvidenceStrength
  }
  routingDecision: RoutingDecision
  memoryAction: MemoryAction
  frontResponseDraft: string
  /** v4：家庭个性化视角配置（调关注点敏感度/语言温度/提问策略） */
  familyAgentPersona?: FamilyAgentPersona
}

// 日常对话页的家长可读卡片（交付文档 4.5 判断差量 + 初版/标准/深度孩子理解分析卡）。
// 由同步的 OrchestrationOutput 纯函数装配，零额外 LLM；前端在 AI 回复后渲染。
// 全部自然语言、家长可读，不含字段名/置信度/机制名（P0 红线）。
export interface DailyCards {
  judgmentDelta?: string
  understandingCard?: { tier: '初版' | '标准' | '深度'; reading: string }
  /** 本轮判断依据（来自已存证据/事件，家长可读） */
  evidenceBasis?: string
  /** 低置信 / 需追问时的结构化追问卡 */
  followUp?: { question: string; distinction?: string }
  /** 深度原因折叠区（来自检索上下文，非重复气泡正文） */
  deepAnalysis?: { title: string; points: string[] }
  /** 高/低置信分流：影响 AI 组件组合 */
  confidenceMode?: 'high' | 'low'
  /** 下一步建议展开时的方向提示（来自路由/检索） */
  adviceSeed?: string
  /** 本轮动态选中的附加组件（最多 3 个，由规则引擎按意图+置信度决定） */
  activeComponents?: Array<
    | 'follow_up'
    | 'judgment_delta'
    | 'evidence'
    | 'deep_reading'
    | 'deep_analysis'
    | 'advice_hint'
    | 'linked_areas'
    | 'action_rehearsal'
    | 'action_task'
  >
  /** BFF 结构化 section（hi-fi 多段气泡） */
  sections?: import('@/types/daily-message').DailySection[]
  /** BFF 底部操作 pill */
  actions?: import('@/types/daily-message').DailyAction[]
}

/** 家长待试任务（独立 user_tasks 层，可关联 sourceTraceId） */
export interface UserTask {
  taskId: string
  familyId: string
  childId: string
  title: string
  source: string
  status: string
  sourceTraceId?: string
  /** 关联 dossier workingHypothesis.predictions[].id（如 pred_1） */
  linkedPredictionId?: string
  observation?: string
  /** 客户端幂等键：离线 outbox 重放时去重 */
  clientId?: string
  /** 客户端反馈时间戳：较旧的重放会被忽略 */
  feedbackClientAt?: string
  feedback?: {
    completed?: string
    effect?: string
    reaction?: string
    note?: string
  }
  createdAt: string
  updatedAt: string
}

// 每轮前台对话的输入+输出快照
// 实现 7.1 字段闭环可追溯 / 13.1 可复现审计——给定 traceId 可取回「喂给 Agent 的上下文 + Agent 产出」。
// daily 主入口由 buildTurnEvent 填满 daily 专属字段；其它前台功能由 buildFeatureTurnEvent 填核心字段
// + specializedContextPackSnapshot（专项输入包），daily 专属字段留空（故下列为可选）。
// recentTurnsSnapshot=[]（daily 无会话缓冲）、knowledgeContextSnapshot=null（知识库 P0 恒空，文档 9.2）。
export interface TurnEvent {
  turnId: string
  traceId: string
  familyId: string
  childId: string
  mode: string
  userMessage: string
  assistantReply: string
  maturityLevel?: MaturityLevel
  inputType?: InputTypeLabel
  relationship?: { type: InputClassification; explanation: string; confidence: EvidenceStrength }
  retrievedContextSnapshot?: RetrievedContext
  routingDecisionSnapshot?: RoutingDecision
  memoryActionSnapshot?: MemoryAction
  specializedContextPackSnapshot?: unknown
  linkedAreas: string[]
  recentTurnsSnapshot: never[]
  knowledgeContextSnapshot: null
  createdAt: string
}

export interface RetrievedContext {
  relevantChildStructureModel: string[]
  relevantEntryEvidencePacks: string[]
  relevantPastEvents: string[]
  relevantPendingHypotheses: string[]
  relevantFamilyInteractionPatterns: string[]
  matchedMechanisms: string[]
  /** v3：从 dossier 确定性切片；ecologicalCalibration 不进此字段 */
  dossierSlice?: string[]
  recentDiagnosis: string[]
  parentNarrativePattern: string[]
  /** 入口采集 / 历史事件中的孩子原话或近原话 */
  childQuotes: string[]
  /** 四模块具体事实直喂（verifiableFacts/childBehaviors/triggerPoints），前端 AI 直读不思考 */
  entryFacts: string[]
  /** 家长原话片段（近期输入） */
  parentVerbatimSnippets?: string[]
  /** v4：按问题域检索的原子事实独立通道（保留 sourceType，不打平混进 supportingEvidence） */
  domainAtomFacts?: string[]
}

/* ================================================================
   知识库预留（交付文档 9.2）。当前 P0 不接逻辑，仅预留 schema：
   knowledgeContext 在前台输入里恒为空，但字段必须存在，便于后续挂载。
   知识库只辅助候选解释/追问策略/表达库/规划/风险边界，不替代 FamilyModel 与家庭事实。
   ================================================================ */
export type KnowledgeCardType =
  | 'behavior_candidate'
  | 'interaction_cycle'
  | 'question_policy'
  | 'communication_expression'
  | 'education_diagnosis'
  | 'family_planning'
  | 'risk_boundary'

export interface KnowledgeCard {
  id: string
  cardType: KnowledgeCardType
  title: string
  applicableScenes: string[]
  triggerFacts: string[]
  counterEvidence: string[]
  parentFacingLanguage: string
  internalNotes?: string
}

export interface KnowledgeContext {
  enabled: boolean
  cards: KnowledgeCard[]
}

export interface RoutingDecision {
  frontResponseType: FrontResponseType
  needFollowup: boolean
  followupQuestion: string
  needMemoryWrite: boolean
  needDeepDiagnosis: boolean
  needResynthesis: boolean
}

export interface MemoryAction {
  writeRawFact: string[]
  writeGrowthRecord: string[]
  updatePendingHypothesis: string[]
  updateStableProfile: string[]
  updateFamilyInteractionPattern: string[]
  updateWeeklyReportMaterial: string[]
  doNotWrite: string[]
}

/* ================================================================
   Memory Retrieval Packets (记忆沉淀与检索 Agent 输出)
   ================================================================ */
export interface DailyDialogueRetrievalPacket {
  retrievalPurpose: 'daily_dialogue'
  contextMaturityLevel: MaturityLevel
  currentInputClassification: InputClassification
  relevantChildStructureModels: string[]
  matchedMechanisms: string[]
  /** v3：dossier 确定性切片（主源） */
  dossierSlice?: string[]
  supportingEvidence: string[]
  recentRelatedEvents: string[]
  pendingHypotheses: string[]
  possibleCounterEvidence: string[]
  childQuotes: string[]
  /** 家长原话片段 */
  parentVerbatimSnippets?: string[]
  /** 四模块采集的具体事实直喂（verifiableFacts/childBehaviors/triggerPoints 合并去重，前端 AI 直读） */
  entryFacts: string[]
  /** 四模块证据包摘要（供 entryEvidence；勿与 episode supportingEvidence 混用） */
  entryEvidencePackSummaries?: string[]
  /** v4：按问题域检索的原子事实独立通道（高价值 atom 保留 sourceType，不打平混进 supportingEvidence） */
  domainAtomFacts?: string[]
  familyInteractionPatterns: string[]
  parentNarrativePattern: Record<string, unknown>
  recommendedHandling: {
    canExplainWithExistingModel: boolean
    shouldAskFollowup: boolean
    followupTarget: string
    shouldTriggerResynthesis: boolean
    shouldUpdateMemory: boolean
    responseGuidance: string
  }
}

export interface DiagnosisRetrievalPacket {
  retrievalPurpose: 'deep_diagnosis'
  contextMaturityLevel: MaturityLevel
  mainMechanismCandidates: string[]
  crossEntryEvidenceNetwork: string[]
  highStrengthEvidence: string[]
  childQuotes: string[]
  parentQuotes: string[]
  familyInteractionCycles: string[]
  childProtectiveStrategies: string[]
  parentMisreadings: string[]
  pendingBoundaries: string[]
  doNotOverstate: string[]
  recommendedDiagnosisStrength: DiagnosisLevel
}

export interface EntryCollectionRetrievalPacket {
  retrievalPurpose: 'entry_collection'
  targetEntry: EntryName
  existingEntryPack: EntryEvidencePack | null
  alreadyAskedQuestions: string[]
  knownFactsForThisEntry: string[]
  missingKeyInfo: string[]
  crossEntrySignals: string[]
  doNotRepeat: string[]
  bestNextQuestionCandidate: {
    question: string
    purpose: string
    targetHypothesis: string
  } | null
}

export interface SynthesisRetrievalPacket {
  retrievalPurpose: 'multi_entry_synthesis'
  entryCoverage: Record<EntryName, EntryCoverage>
  entryEvidencePacks: EntryEvidencePack[]
  existingEvidenceNetwork: CrossEntryEvidenceNetwork | null
  stableProfiles: ConditionalProfile[]
  stageJudgments: ConditionalProfile[]
  pendingHypotheses: PendingHypothesis[]
  recentUpdates: DailyInteractionUpdate[]
  counterEvidence: string[]
  mechanismsToReevaluate: string[]
  suggestedSynthesisFocus: string[]
}

export type RetrievalPacket =
  | DailyDialogueRetrievalPacket
  | DiagnosisRetrievalPacket
  | EntryCollectionRetrievalPacket
  | SynthesisRetrievalPacket

/* ================================================================
   Memory Write Plan (记忆沉淀 Agent 写入计划)
   ================================================================ */
export interface MemoryWritePlan {
  rawMaterialsToWrite: RawMaterial[]
  cleanedFactsToWrite: CleanedFact[]
  entryEvidencePacksToUpdate: EntryEvidencePack[]
  crossEntryNetworksToUpdate: CrossEntryEvidenceNetwork[]
  childStructureModelsToCreateOrUpdate: ChildStructureModel[]
  pendingHypothesesToCreateOrUpdate: PendingHypothesis[]
  familyInteractionCyclesToCreateOrUpdate: FamilyInteractionCycle[]
  parentNarrativePatternsToUpdate: ParentNarrativePattern[]
  dailyInteractionUpdatesToWrite: DailyInteractionUpdate[]
  retrievalTagsToAdd: RetrievalIndex[]
  oldItemsToSupersede: string[]
  itemsNotToWriteAsStableMemory: string[]
  writeRationale: {
    whyUpdate: string
    whyNotPromoteSomeItems: string
    riskOfOvergeneralization: string
    nextVerificationNeed: string
  }
}

/* ================================================================
   Context Maturity State
   ================================================================ */
export interface ContextMaturityState {
  familyId: string
  childId: string
  level: MaturityLevel
  entryCompletion: Record<EntryName, boolean>
  hasProfile: boolean
  hasStableProfile: boolean
  hypothesisCount: number
  dailyInteractionCount: number
  lastInteractionAt?: string
  lastDiagnosisAt?: string
  lastProfileUpdateAt?: string
  updatedAt: string
}

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
  | 'one_key_followup'
  | 'communication_prehearsal'
  | 'conflict_review'
  | 'profile_update_notice'
  | 'trigger_deep_diagnosis'
  | 'trigger_resynthesis'
  | 'safety_response'

export type DiagnosisTaskType =
  | 'initial_model'
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
  | 'casual_chat'

export type DailyMemoryImpact = 'increase_strength' | 'decrease_strength' | 'narrow_scope' | 'new_mechanism' | 'no_change' | 'safety_record'

export type ChildProfileStatus = 'stable' | 'stage_judgment' | 'pending'

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
    childQuotes: string[]
    parentQuotes: string[]
    parentActions: string[]
    triggerPoints: string[]
    timePlacePeople: string[]
    parentEmotions: string[]
    parentEvaluations: string[]
    parentAssumptions: string[]
    parentGoals: string[]
    backgroundFactors: string[]
    missingInformation: string[]
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

export interface CandidateMechanism {
  mechanismName: string
  mechanismType: MechanismType
  description: string
  supportedByEntries: EntryName[]
  supportingEvidence: string[]
  explainedBehaviors: string[]
  possibleProtectiveFunction: string
  familyInteractionChain: FamilyInteractionChain
  scores: MechanismScore
  overallStrength: EvidenceStrength
  applicableScope: string
  missingEvidence: string[]
  possibleAlternativeExplanations: string[]
  shouldPromoteToDiagnosis: boolean
}

export interface CrossEntryEvidenceNetwork {
  networkId: string
  familyId: string
  childId: string
  maturityLevel: MaturityLevel
  inputCoverage: Record<EntryName, EntryCoverage>
  crossEntryEvidenceMap: CrossEntryEvidence[]
  candidateMechanismMatrix: CandidateMechanism[]
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
  likelyFamilyInteractionPatterns: string[]
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
  missingEvidence: string[]
  verificationQuestions: string[]
  possibleCounterEvidence: string[]
  weight: HypothesisWeight
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
  relatedEvidence: string[]
  recommendedResponseLogic: string
  memoryImpact: DailyMemoryImpact
  updatedTargets: string[]
  timestamp: string
  createdAt: string
  sourceEventId?: string  // traceId：贯穿 userMessage→memory write→episode→job 的可追溯链路
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
}

// 日常对话页的家长可读卡片（交付文档 4.5 判断差量 + 初版/标准/深度孩子理解分析卡）。
// 由同步的 OrchestrationOutput 纯函数装配，零额外 LLM；前端在 AI 回复后渲染。
// 全部自然语言、家长可读，不含字段名/置信度/机制名（P0 红线）。
export interface DailyCards {
  judgmentDelta?: string                                                    // 本轮判断变化，仅真有变化/新方向时给
  understandingCard?: { tier: '初版' | '标准' | '深度'; reading: string }   // 孩子理解卡，档位按成熟度
}

// 每轮前台对话的输入+输出快照（交付文档 7.2 TurnEvent）。按 traceId 持久化，
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
  recentDiagnosis: string[]
  parentNarrativePattern: string[]
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
  supportingEvidence: string[]
  recentRelatedEvents: string[]
  pendingHypotheses: string[]
  possibleCounterEvidence: string[]
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

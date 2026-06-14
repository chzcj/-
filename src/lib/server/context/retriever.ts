import type {
  MaturityLevel,
  EntryName,
  EntryEvidencePack,
  CrossEntryEvidenceNetwork,
  ConditionalProfile,
  PendingHypothesis,
  FamilyInteractionCycle,
  ParentNarrativePattern,
  DailyInteractionUpdate,
  RawMaterial,
  CleanedFact,
  ContextMaturityState,
  DailyDialogueRetrievalPacket,
  DiagnosisRetrievalPacket,
  EntryCollectionRetrievalPacket,
  SynthesisRetrievalPacket
} from '@/types/database'
import { getCurrentMaturityState } from './maturity'

/* ================================================================
   Context Retriever — 上下文检索器
   按母稿 §11.1 和记忆 SP §5 的检索优先级组装上下文
   ================================================================ */

export interface ContextRetrievalOptions {
  maturityState?: ContextMaturityState
  currentInput?: string
  targetEntry?: EntryName
  conversationId?: string
}

function getMaturity(): ContextMaturityState {
  try {
    return getCurrentMaturityState()
  } catch {
    return {
      familyId: 'family_demo',
      childId: 'child_demo',
      level: 'L0',
      entryCompletion: {
        learning_homework: false,
        daily_rhythm_phone: false,
        parent_child_communication: false,
        emotional_stress: false,
        relationship_environment: false
      },
      hasProfile: false,
      hasStableProfile: false,
      hypothesisCount: 0,
      dailyInteractionCount: 0,
      updatedAt: new Date().toISOString()
    }
  }
}

/* ================================================================
   Memory Layer Getters — 从 localStorage 读取现有数据
   ================================================================ */

function readLocalStorage() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('childos.v1')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getRawMaterials(): RawMaterial[] {
  const storage = readLocalStorage()
  if (!storage) return []
  const records = storage.entryRecords || []
  return records.map((r: Record<string, unknown>) => ({
    materialId: String(r.id || ''),
    familyId: String(r.familyId || storage.activeFamilyId || ''),
    childId: String(r.childId || storage.activeChildId || ''),
    source: String(r.sourceType || 'text') as 'voice' | 'text',
    rawText: String(r.rawText || ''),
    speaker: 'parent' as const,
    timestamp: String(r.createdAt || ''),
    createdAt: String(r.createdAt || '')
  }))
}

function getCleanedFacts(): CleanedFact[] {
  const storage = readLocalStorage()
  if (!storage) return []
  const entries = storage.entryRecords || []
  return entries.map((r: Record<string, unknown>) => ({
    factId: String(r.id || ''),
    familyId: String(r.familyId || storage.activeFamilyId || ''),
    childId: String(r.childId || storage.activeChildId || ''),
    sourceRawIds: [String(r.id || '')],
    scene: String(r.entryType || ''),
    event: String(r.rawText || ''),
    parentEvaluation: '',
    evidenceStrength: 'medium' as const,
    missingInfo: [],
    crossEntrySignals: [],
    createdAt: String(r.createdAt || ''),
    updatedAt: String(r.updatedAt || '')
  }))
}

function getEntryEvidencePacks(): EntryEvidencePack[] {
  const storage = readLocalStorage()
  if (!storage) return []
  const summaries = storage.stageSummaries || []
  return summaries.map((s: Record<string, unknown>) => ({
    packId: String(s.id || ''),
    familyId: String(s.familyId || ''),
    childId: String(s.childId || ''),
    entryName: mapLegacyEntry(String(s.entryType || '')) as EntryName,
    entryStatus: 'evidence_pack_ready' as const,
    rawInputSummary: String(s.mainJudgment || ''),
    decomposedInput: {
      verifiableFacts: Array.isArray(s.facts) ? s.facts as string[] : [],
      childBehaviors: [],
      childQuotes: [],
      parentQuotes: [],
      parentActions: [],
      triggerPoints: [],
      timePlacePeople: [],
      parentEmotions: [],
      parentEvaluations: [],
      parentAssumptions: [],
      parentGoals: [],
      backgroundFactors: [],
      missingInformation: []
    },
    candidateMechanisms: [],
    evidenceUnits: [],
    followupCandidates: [],
    crossEntrySignals: [],
    handoffToSummaryAgent: {
      mostImportantEvidence: [],
      mostLikelyLocalMechanisms: Array.isArray(s.pendingHypotheses) ? s.pendingHypotheses as string[] : [],
      mostImportantGaps: [],
      possibleLinksToOtherEntries: [],
      warnings: []
    },
    alreadyAskedQuestions: [],
    createdAt: String(s.createdAt || ''),
    updatedAt: String(s.updatedAt || '')
  }))
}

function getConditionalProfiles(): ConditionalProfile[] {
  const storage = readLocalStorage()
  if (!storage) return []
  const profiles = storage.profileSnapshots || []
  return profiles.map((p: Record<string, unknown>) => ({
    profileId: String(p.id || ''),
    familyId: String(p.familyId || ''),
    childId: String(p.childId || ''),
    status: 'stage_judgment' as const,
    triggerScene: '',
    childTendency: String(p.coreJudgment || ''),
    notBecause: '',
    likelyBecause: String(p.deepMechanism || ''),
    parentInterventionEffect: '',
    protectiveStrategy: String(p.supportFocus || ''),
    evidenceSources: [],
    strength: 'medium' as const,
    boundaries: [],
    version: 1,
    createdAt: String(p.createdAt || ''),
    updatedAt: String(p.updatedAt || '')
  }))
}

function getPendingHypotheses(): PendingHypothesis[] {
  const storage = readLocalStorage()
  if (!storage) return []
  const vps = storage.verificationPoints || []
  return vps.map((v: Record<string, unknown>) => ({
    hypothesisId: String(v.id || ''),
    familyId: String(v.familyId || ''),
    childId: String(v.childId || ''),
    hypothesis: String(v.title || ''),
    triggerSource: '',
    supportingEvidence: [],
    missingEvidence: [String(v.description || '')],
    verificationQuestions: [],
    possibleCounterEvidence: [],
    weight: 'medium' as const,
    applicableScenes: [],
    status: String(v.status || 'active') as 'pending' | 'resolved' | 'dismissed',
    retrievalTags: [],
    createdAt: String(v.createdAt || ''),
    updatedAt: String(v.updatedAt || '')
  }))
}

function getDailyInteractionUpdates(): DailyInteractionUpdate[] {
  const storage = readLocalStorage()
  if (!storage) return []
  const observations = storage.dailyObservations || []
  return observations.map((o: Record<string, unknown>) => ({
    updateId: String(o.id || ''),
    familyId: String(o.familyId || ''),
    childId: String(o.childId || ''),
    newInput: String(o.rawText || ''),
    classification: 'pure_record' as const,
    matchedMechanisms: Array.isArray(o.linkedAreas) ? o.linkedAreas as string[] : [],
    relatedEvidence: [],
    recommendedResponseLogic: '',
    memoryImpact: 'no_change' as const,
    updatedTargets: [],
    timestamp: String(o.observedAt || ''),
    createdAt: String(o.createdAt || '')
  }))
}

function mapLegacyEntry(legacy: string): string {
  const mapping: Record<string, string> = {
    study: 'learning_homework',
    routine: 'daily_rhythm_phone',
    communication: 'parent_child_communication',
    emotion: 'emotional_stress',
    environment: 'relationship_environment'
  }
  return mapping[legacy] || legacy
}

/* ================================================================
   Retrieval Packet Builders
   ================================================================ */

export function buildDailyDialogueRetrievalPacket(
  options: ContextRetrievalOptions = {}
): DailyDialogueRetrievalPacket {
  const maturity = options.maturityState || getMaturity()
  const profiles = getConditionalProfiles()
  const packs = getEntryEvidencePacks()
  const observations = getDailyInteractionUpdates()
  const hypotheses = getPendingHypotheses()

  const recentEvents = observations.slice(-10).map(o => o.newInput)
  const profileTexts = profiles.map(p => p.childTendency)
  const hypothesisTexts = hypotheses.map(h => h.hypothesis)
  const packRefs = packs.map(p => `${p.entryName}: ${p.rawInputSummary}`)

  return {
    retrievalPurpose: 'daily_dialogue',
    contextMaturityLevel: maturity.level,
    currentInputClassification: 'insufficient',
    relevantChildStructureModels: profileTexts,
    matchedMechanisms: [],
    supportingEvidence: recentEvents.slice(-5),
    recentRelatedEvents: recentEvents,
    pendingHypotheses: hypothesisTexts,
    possibleCounterEvidence: [],
    parentNarrativePattern: {},
    recommendedHandling: {
      canExplainWithExistingModel: profiles.length > 0,
      shouldAskFollowup: maturity.level === 'L0',
      followupTarget: '',
      shouldTriggerResynthesis: false,
      shouldUpdateMemory: true,
      responseGuidance: maturity.level === 'L0'
        ? '引导家长进入五入口采集'
        : '基于已有画像尝试解释'
    }
  }
}

export function buildDiagnosisRetrievalPacket(): DiagnosisRetrievalPacket {
  const maturity = getMaturity()
  const profiles = getConditionalProfiles()
  const packs = getEntryEvidencePacks()

  return {
    retrievalPurpose: 'deep_diagnosis',
    contextMaturityLevel: maturity.level,
    mainMechanismCandidates: [],
    crossEntryEvidenceNetwork: packs.map(p => p.rawInputSummary),
    highStrengthEvidence: [],
    childQuotes: [],
    parentQuotes: [],
    familyInteractionCycles: [],
    childProtectiveStrategies: [],
    parentMisreadings: [],
    pendingBoundaries: [],
    doNotOverstate: [],
    recommendedDiagnosisStrength: maturity.level === 'L2' ? 'stage' : 'direction'
  }
}

export function buildEntryCollectionRetrievalPacket(
  targetEntry: EntryName
): EntryCollectionRetrievalPacket {
  const packs = getEntryEvidencePacks()
  const existingPack = packs.find(p => p.entryName === targetEntry) || null

  return {
    retrievalPurpose: 'entry_collection',
    targetEntry,
    existingEntryPack: existingPack,
    alreadyAskedQuestions: existingPack?.alreadyAskedQuestions || [],
    knownFactsForThisEntry: existingPack?.decomposedInput.verifiableFacts || [],
    missingKeyInfo: existingPack?.decomposedInput.missingInformation || [],
    crossEntrySignals: existingPack?.crossEntrySignals || [],
    doNotRepeat: existingPack?.alreadyAskedQuestions || [],
    bestNextQuestionCandidate: null
  }
}

export function buildSynthesisRetrievalPacket(): SynthesisRetrievalPacket {
  const maturity = getMaturity()
  const packs = getEntryEvidencePacks()
  const profiles = getConditionalProfiles()
  const hypotheses = getPendingHypotheses()
  const updates = getDailyInteractionUpdates()

  const entryCoverage = {
    learning_homework: packs.some(p => p.entryName === 'learning_homework') ? 'sufficient' as const : 'missing' as const,
    daily_rhythm_phone: packs.some(p => p.entryName === 'daily_rhythm_phone') ? 'sufficient' as const : 'missing' as const,
    parent_child_communication: packs.some(p => p.entryName === 'parent_child_communication') ? 'sufficient' as const : 'missing' as const,
    emotional_stress: packs.some(p => p.entryName === 'emotional_stress') ? 'sufficient' as const : 'missing' as const,
    relationship_environment: packs.some(p => p.entryName === 'relationship_environment') ? 'sufficient' as const : 'missing' as const
  }

  return {
    retrievalPurpose: 'multi_entry_synthesis',
    entryCoverage,
    entryEvidencePacks: packs,
    existingEvidenceNetwork: null,
    stableProfiles: profiles.filter(p => p.status === 'stable'),
    stageJudgments: profiles.filter(p => p.status === 'stage_judgment'),
    pendingHypotheses: hypotheses,
    recentUpdates: updates.slice(-10),
    counterEvidence: [],
    mechanismsToReevaluate: [],
    suggestedSynthesisFocus: []
  }
}

/* ================================================================
   Convenience: 完整上下文上下文读取（供所有 Agent 初始化用）
   ================================================================ */

export function retrieveFullContext(options: ContextRetrievalOptions = {}) {
  return {
    maturity: options.maturityState || getMaturity(),
    rawMaterials: getRawMaterials(),
    cleanedFacts: getCleanedFacts(),
    entryEvidencePacks: getEntryEvidencePacks(),
    conditionalProfiles: getConditionalProfiles(),
    pendingHypotheses: getPendingHypotheses(),
    dailyUpdates: getDailyInteractionUpdates()
  }
}

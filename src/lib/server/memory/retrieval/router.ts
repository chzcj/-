import type {
  DailyDialogueRetrievalPacket,
  DiagnosisRetrievalPacket,
  EntryCollectionRetrievalPacket,
  SynthesisRetrievalPacket,
  EntryName
} from '@/types/database'
import { getCurrentMaturityState } from '@/lib/server/context/maturity'
import {
  getEntryEvidencePacks,
  getEntryEvidencePack,
  getLatestEvidenceNetwork,
  getLatestChildStructureModel,
  getConditionalProfiles,
  getPendingHypotheses,
  getFamilyInteractionCycles,
  getDailyInteractionUpdates
} from '../../memory/database-manager'

/* ================================================================
   Retrieval Router — 检索路由
   ================================================================ */

function promoteMaturity(
  currentLevel: ReturnType<typeof getCurrentMaturityState>['level'],
  signals: { profiles?: number; hasModel?: boolean; hasNetwork?: boolean; packs?: number }
) {
  if (signals.hasModel || (signals.profiles || 0) > 0) return 'L3' as const
  if (signals.hasNetwork || (signals.packs || 0) >= 3) return 'L2' as const
  return currentLevel
}

export async function buildDailyDialogueRetrievalPacket(): Promise<DailyDialogueRetrievalPacket> {
  const maturity = getCurrentMaturityState()
  const [profiles, packs, updates, hypotheses, network, model] = await Promise.all([
    getConditionalProfiles(),
    getEntryEvidencePacks(),
    getDailyInteractionUpdates(),
    getPendingHypotheses(),
    getLatestEvidenceNetwork(),
    getLatestChildStructureModel()
  ])
  const effectiveLevel = promoteMaturity(maturity.level, {
    profiles: profiles.length,
    hasModel: Boolean(model),
    hasNetwork: Boolean(network),
    packs: packs.length
  })

  const recentEvents = updates.slice(-10).map(u => u.newInput)
  const profileTexts = profiles.map(p => p.childTendency)
  const packRefs = packs.map(p => `${p.entryName}: ${p.rawInputSummary}`)

  const matchingProfile = model?.primaryConditionalProfile?.childTendency || null

  return {
    retrievalPurpose: 'daily_dialogue',
    contextMaturityLevel: effectiveLevel,
    currentInputClassification: 'insufficient',
    relevantChildStructureModels: profileTexts.length > 0 ? profileTexts : (matchingProfile ? [matchingProfile] : []),
    matchedMechanisms: network?.candidateMechanismMatrix?.filter(m => m.overallStrength === 'high').map(m => m.mechanismName) || [],
    supportingEvidence: recentEvents.slice(-5),
    recentRelatedEvents: recentEvents,
    pendingHypotheses: hypotheses.map(h => h.hypothesis),
    possibleCounterEvidence: [],
    parentNarrativePattern: {},
    recommendedHandling: {
      canExplainWithExistingModel: profiles.length > 0 || (model?.primaryConditionalProfile != null),
      shouldAskFollowup: effectiveLevel === 'L0' || effectiveLevel === 'L1',
      followupTarget: '',
      shouldTriggerResynthesis: false,
      shouldUpdateMemory: true,
      responseGuidance: effectiveLevel === 'L0'
        ? '引导家长进入五入口采集'
        : effectiveLevel === 'L1'
        ? '继续入口采集，不急于综合'
        : '基于已有画像尝试解释，不重复追问基础信息'
    }
  }
}

export async function buildDiagnosisRetrievalPacket(): Promise<DiagnosisRetrievalPacket> {
  const maturity = getCurrentMaturityState()
  const [packs, profiles, network, hypotheses, cycles, model] = await Promise.all([
    getEntryEvidencePacks(),
    getConditionalProfiles(),
    getLatestEvidenceNetwork(),
    getPendingHypotheses(),
    getFamilyInteractionCycles(),
    getLatestChildStructureModel()
  ])
  const effectiveLevel = promoteMaturity(maturity.level, {
    profiles: profiles.length,
    hasModel: Boolean(model),
    hasNetwork: Boolean(network),
    packs: packs.length
  })

  return {
    retrievalPurpose: 'deep_diagnosis',
    contextMaturityLevel: effectiveLevel,
    mainMechanismCandidates: network?.candidateMechanismMatrix?.map(m => m.mechanismName) || [],
    crossEntryEvidenceNetwork: packs.map(p => `[${p.entryName}] ${p.rawInputSummary}`),
    highStrengthEvidence: network?.candidateMechanismMatrix?.filter(m => m.overallStrength === 'high').map(m => m.description) || [],
    childQuotes: packs.flatMap(p => p.decomposedInput.childQuotes).filter(Boolean),
    parentQuotes: packs.flatMap(p => p.decomposedInput.parentQuotes).filter(Boolean),
    familyInteractionCycles: cycles.map(c => c.cycleName),
    childProtectiveStrategies: model?.dominantProtectiveStrategies || [],
    parentMisreadings: [],
    pendingBoundaries: profiles.flatMap(p => p.boundaries),
    doNotOverstate: [],
    recommendedDiagnosisStrength: effectiveLevel === 'L4' ? 'core_profile' : effectiveLevel === 'L3' ? 'core_profile' : 'stage'
  }
}

export async function buildEntryCollectionRetrievalPacket(targetEntry: EntryName): Promise<EntryCollectionRetrievalPacket> {
  const existingPack = await getEntryEvidencePack(targetEntry)

  return {
    retrievalPurpose: 'entry_collection',
    targetEntry,
    existingEntryPack: existingPack,
    alreadyAskedQuestions: existingPack?.alreadyAskedQuestions || [],
    knownFactsForThisEntry: existingPack?.decomposedInput.verifiableFacts || [],
    missingKeyInfo: existingPack?.decomposedInput.missingInformation || [],
    crossEntrySignals: existingPack?.crossEntrySignals || [],
    doNotRepeat: existingPack?.alreadyAskedQuestions || [],
    bestNextQuestionCandidate: existingPack?.followupCandidates?.[0]
      ? {
          question: existingPack.followupCandidates[0].question,
          purpose: existingPack.followupCandidates[0].purpose,
          targetHypothesis: existingPack.followupCandidates[0].targetMechanism
        }
      : null
  }
}

export async function buildSynthesisRetrievalPacket(): Promise<SynthesisRetrievalPacket> {
  const maturity = getCurrentMaturityState()
  const [packs, profiles, hypotheses, updates, network, model] = await Promise.all([
    getEntryEvidencePacks(),
    getConditionalProfiles(),
    getPendingHypotheses(),
    getDailyInteractionUpdates(),
    getLatestEvidenceNetwork(),
    getLatestChildStructureModel()
  ])
  const effectiveLevel = promoteMaturity(maturity.level, {
    profiles: profiles.length,
    hasModel: Boolean(model),
    hasNetwork: Boolean(network),
    packs: packs.length
  })

  const entryCoverage = {
    learning_homework: (packs.some(p => p.entryName === 'learning_homework') ? 'sufficient' : 'missing') as 'sufficient' | 'missing',
    daily_rhythm_phone: (packs.some(p => p.entryName === 'daily_rhythm_phone') ? 'sufficient' : 'missing') as 'sufficient' | 'missing',
    parent_child_communication: (packs.some(p => p.entryName === 'parent_child_communication') ? 'sufficient' : 'missing') as 'sufficient' | 'missing',
    emotional_stress: (packs.some(p => p.entryName === 'emotional_stress') ? 'sufficient' : 'missing') as 'sufficient' | 'missing',
    relationship_environment: (packs.some(p => p.entryName === 'relationship_environment') ? 'sufficient' : 'missing') as 'sufficient' | 'missing'
  }

  return {
    retrievalPurpose: 'multi_entry_synthesis',
    entryCoverage,
    entryEvidencePacks: packs,
    existingEvidenceNetwork: network,
    stableProfiles: profiles.filter(p => p.status === 'stable'),
    stageJudgments: profiles.filter(p => p.status === 'stage_judgment'),
    pendingHypotheses: hypotheses,
    recentUpdates: updates.slice(-10),
    counterEvidence: [],
    mechanismsToReevaluate: [],
    suggestedSynthesisFocus: effectiveLevel === 'L0' ? [] : ['基于现有结构模型继续交叉验证']
  }
}

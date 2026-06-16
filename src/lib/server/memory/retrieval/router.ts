import type {
  DailyDialogueRetrievalPacket,
  DiagnosisRetrievalPacket,
  EntryCollectionRetrievalPacket,
  SynthesisRetrievalPacket,
  EntryName
} from '@/types/database'
import { getCurrentMaturityState } from '@/lib/server/context/maturity'
import { isEmbeddingEnabled, rankByRelevance } from '../embedding'
import { retrieveContextPack } from './episode-retriever'
import type { TenantId } from '../tenant'
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

export async function buildDailyDialogueRetrievalPacket(query: string | undefined, tenant: TenantId): Promise<DailyDialogueRetrievalPacket> {
  const maturity = getCurrentMaturityState(tenant)
  const [profiles, packs, updates, hypotheses, network, model] = await Promise.all([
    getConditionalProfiles(tenant),
    getEntryEvidencePacks(tenant),
    getDailyInteractionUpdates(tenant),
    getPendingHypotheses(tenant),
    getLatestEvidenceNetwork(tenant),
    getLatestChildStructureModel(tenant)
  ])
  const effectiveLevel = promoteMaturity(maturity.level, {
    profiles: profiles.length,
    hasModel: Boolean(model),
    hasNetwork: Boolean(network),
    packs: packs.length
  })

  // 候选事实池：全部历史日常事件。
  const allEvents = updates.map(u => u.newInput).filter((t): t is string => Boolean(t))

  // 三级降级链：① 三层语义检索(Episode场景包) → ② 应用层 rankByRelevance → ③ 取最近。
  let recentEvents: string[]
  let supportingEvidence: string[]
  const pack = query ? await retrieveContextPack(query, { familyId: tenant.familyId, childId: tenant.childId }) : undefined
  if (pack) {
    // ① Episode 召回：summary 作为支撑证据，叠加高价值 Atom（孩子原话/反证等）
    const episodeTexts = pack.episodes.map(e => e.summary)
    const highValueAtomTexts = pack.episodes
      .flatMap(e => e.atoms.filter(a => a.isHighValue).map(a => a.content))
      .concat(pack.extraHighValueAtoms.map(a => a.content))
    recentEvents = episodeTexts.length > 0 ? episodeTexts : allEvents.slice(-10)
    supportingEvidence = [...episodeTexts.slice(0, 3), ...highValueAtomTexts.slice(0, 2)].slice(0, 5)
    if (supportingEvidence.length === 0) supportingEvidence = allEvents.slice(-5)
  } else if (query && isEmbeddingEnabled() && allEvents.length > 0) {
    // ② 应用层向量精排（对 DailyUpdate.newInput）
    const ranked = await rankByRelevance(query, allEvents, (e) => e, 10)
    recentEvents = ranked.map(r => r.item)
    supportingEvidence = ranked.slice(0, 5).map(r => r.item)
  } else {
    // ③ 取最近
    recentEvents = allEvents.slice(-10)
    supportingEvidence = allEvents.slice(-5)
  }

  const profileTexts = profiles.map(p => p.childTendency)

  const matchingProfile = model?.primaryConditionalProfile?.childTendency || null

  return {
    retrievalPurpose: 'daily_dialogue',
    contextMaturityLevel: effectiveLevel,
    currentInputClassification: 'insufficient',
    relevantChildStructureModels: profileTexts.length > 0 ? profileTexts : (matchingProfile ? [matchingProfile] : []),
    matchedMechanisms: network?.candidateMechanismMatrix?.filter(m => m.overallStrength === 'high').map(m => m.mechanismName) || [],
    supportingEvidence,
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

export async function buildDiagnosisRetrievalPacket(tenant: TenantId): Promise<DiagnosisRetrievalPacket> {
  const maturity = getCurrentMaturityState(tenant)
  const [packs, profiles, network, hypotheses, cycles, model] = await Promise.all([
    getEntryEvidencePacks(tenant),
    getConditionalProfiles(tenant),
    getLatestEvidenceNetwork(tenant),
    getPendingHypotheses(tenant),
    getFamilyInteractionCycles(tenant),
    getLatestChildStructureModel(tenant)
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

export async function buildEntryCollectionRetrievalPacket(targetEntry: EntryName, tenant: TenantId): Promise<EntryCollectionRetrievalPacket> {
  const existingPack = await getEntryEvidencePack(targetEntry, tenant)

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

export async function buildSynthesisRetrievalPacket(tenant: TenantId): Promise<SynthesisRetrievalPacket> {
  const maturity = getCurrentMaturityState(tenant)
  const [packs, profiles, hypotheses, updates, network, model] = await Promise.all([
    getEntryEvidencePacks(tenant),
    getConditionalProfiles(tenant),
    getPendingHypotheses(tenant),
    getDailyInteractionUpdates(tenant),
    getLatestEvidenceNetwork(tenant),
    getLatestChildStructureModel(tenant)
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

import type {
  InputClassification,
  EntryEvidencePack,
  ChildStructureModel,
  ConditionalProfile,
  PendingHypothesis,
  FamilyInteractionCycle,
  DiagnosisOutput,
  SynthesisOutput,
  DailyInteractionUpdate,
  RawMaterial,
  CleanedFact,
  RetrievalIndex,
  MemoryWritePlan
} from '@/types/database'
import {
  saveRawMaterials,
  saveCleanedFacts,
  saveEntryEvidencePack,
  saveEvidenceNetwork,
  saveChildStructureModel,
  saveConditionalProfile,
  savePendingHypotheses,
  saveFamilyInteractionCycles,
  saveDailyInteractionUpdate,
  saveRetrievalIndexes
} from '../database-manager'
import {
  buildIndexesForMaterial,
  buildIndexesForEvidencePack,
  buildIndexesForDailyUpdate
} from '../index-tag-engine'
import type { TenantId } from '../tenant'
import { createId } from '@/lib/storage/storageIds'

/* ================================================================
   Write Decision Engine — 写入决策引擎
   ================================================================ */

function normalizeStrength(value: unknown): 'low' | 'medium' | 'high' {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  if (typeof value === 'number') {
    if (value >= 0.8) return 'high'
    if (value <= 0.35) return 'low'
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower.includes('high') || lower.includes('高') || Number(lower) >= 0.8) return 'high'
    if (lower.includes('low') || lower.includes('低') || Number(lower) <= 0.35) return 'low'
  }
  return 'medium'
}

export function classifyInputForMemory(
  newInput: string,
  matchedMechanisms: string[],
  hasConflict: boolean
): InputClassification {
  if (hasConflict) return 'counter_evidence'
  if (matchedMechanisms.length === 0) return 'new_mechanism_signal'
  return 'old_mechanism_repetition'
}

export function buildMemoryWritePlan(options: {
  tenant: TenantId
  rawMaterials?: RawMaterial[]
  cleanedFacts?: CleanedFact[]
  entryEvidencePacks?: EntryEvidencePack[]
  crossEntryNetwork?: { networkData: unknown }
  childStructureModel?: ChildStructureModel
  conditionalProfiles?: ConditionalProfile[]
  pendingHypotheses?: PendingHypothesis[]
  interactionCycles?: FamilyInteractionCycle[]
  dailyUpdates?: DailyInteractionUpdate[]
  retrievalIndexes?: RetrievalIndex[]
  diagnosisOutput?: DiagnosisOutput
  synthesisOutput?: SynthesisOutput
  oldItemsToSupersede?: string[]
  itemsNotToWrite?: string[]
  rationale?: {
    whyUpdate: string
    whyNotPromoteSomeItems: string
    riskOfOvergeneralization: string
    nextVerificationNeed: string
  }
}): MemoryWritePlan {
  const now = new Date().toISOString()
  const synthesis = options.synthesisOutput || options.crossEntryNetwork?.networkData as SynthesisOutput | undefined
  const diagnosis = options.diagnosisOutput
  const diagnosisProfileText = diagnosis?.secondMeConditionalProfile?.[0] || ''
  const diagnosisPrimaryProfile: ConditionalProfile | null = diagnosisProfileText
    ? {
        profileId: createId('prof'),
        familyId: options.tenant.familyId,
        childId: options.tenant.childId,
        status: 'stage_judgment',
        triggerScene: diagnosis?.surfaceProblem || '',
        childTendency: diagnosisProfileText,
        notBecause: diagnosis?.parentSurfaceJudgment || '',
        likelyBecause: diagnosis?.parentMisjudgmentCorrection || '',
        parentInterventionEffect: diagnosis?.primaryMechanismChain?.reinforcingAction || '',
        protectiveStrategy: diagnosis?.primaryMechanismChain?.childProtectionStrategy || '',
        evidenceSources: diagnosis?.lowMisjudgmentFacts || [],
        strength: 'medium',
        boundaries: diagnosis?.needsFurtherVerification || [],
        version: 1,
        createdAt: now,
        updatedAt: now
      }
    : null
  const diagnosisCycle = diagnosis?.familyInteractionLoop
  const diagnosisInteractionCycles: FamilyInteractionCycle[] = diagnosisCycle?.patternName
    ? [{
        cycleId: createId('cycle'),
        familyId: options.tenant.familyId,
        childId: options.tenant.childId,
        cycleName: diagnosisCycle.patternName,
        parentTriggerAction: diagnosis?.primaryMechanismChain?.parentAction || '',
        parentReasonableGoal: '帮助孩子进步',
        childReception: diagnosis?.primaryMechanismChain?.childReception || '',
        childReaction: diagnosis?.primaryMechanismChain?.childProtectionStrategy || '',
        parentSecondInterpretation: diagnosis?.primaryMechanismChain?.parentSecondInterpretation || '',
        parentReinforcementAction: diagnosis?.primaryMechanismChain?.reinforcingAction || '',
        childFurtherStrategy: diagnosis?.childSelfProtection?.immatureButFunctionalStrategy || '',
        longTermEffect: diagnosis?.primaryMechanismChain?.longTermCost || '',
        supportingEvidence: diagnosisCycle.evidence || diagnosis?.lowMisjudgmentFacts || [],
        sceneScope: diagnosisCycle.sceneScope || '家庭学习系统',
        status: diagnosisCycle.status || 'stage',
        version: 1,
        createdAt: now,
        updatedAt: now
      }]
    : []
  const diagnosisModel: ChildStructureModel | undefined = diagnosis && diagnosisPrimaryProfile
    ? {
        modelId: createId('model'),
        familyId: options.tenant.familyId,
        childId: options.tenant.childId,
        maturityLevel: diagnosis.contextMaturityLevel,
        primaryConditionalProfile: diagnosisPrimaryProfile,
        secondaryConditionalProfiles: [],
        dominantProtectiveStrategies: [
          ...(diagnosis.childSelfProtection?.protectingWhat || []),
          ...(diagnosis.childSelfProtection?.surfaceBehavior || [])
        ],
        likelyFamilyInteractionPatterns: diagnosisInteractionCycles.map(c => c.cycleName),
        learningSituationHypotheses: diagnosis.mainMechanismCandidates.map(m => m.mechanismName),
        emotionalPressureHypotheses: diagnosis.needsFurtherVerification,
        trustAndCommunicationHypotheses: diagnosis.handoffToMemoryAgent.patternsToUpdate,
        boundaries: diagnosis.needsFurtherVerification,
        createdAt: now,
        updatedAt: now
      }
    : undefined

  return {
    rawMaterialsToWrite: options.rawMaterials || [],
    cleanedFactsToWrite: options.cleanedFacts || [],
    entryEvidencePacksToUpdate: options.entryEvidencePacks || [],
    crossEntryNetworksToUpdate: synthesis
      ? [{
          networkId: createId('net'),
          familyId: options.tenant.familyId,
          childId: options.tenant.childId,
          maturityLevel: synthesis.contextMaturityLevel,
          inputCoverage: synthesis.inputCoverage || {
            learning_homework: 'sufficient',
            daily_rhythm_phone: 'sufficient',
            parent_child_communication: 'sufficient',
            emotional_stress: 'sufficient',
            relationship_environment: 'sufficient'
          },
          crossEntryEvidenceMap: synthesis.crossEntryEvidenceMap || [],
          candidateMechanismMatrix: (synthesis.candidateMechanismMatrix || []).map(mechanism => ({
            ...mechanism,
            overallStrength: normalizeStrength(mechanism.overallStrength)
          })),
          createdAt: now,
          updatedAt: now
        }]
      : [],
    childStructureModelsToCreateOrUpdate: options.childStructureModel ? [options.childStructureModel] : (diagnosisModel ? [diagnosisModel] : []),
    pendingHypothesesToCreateOrUpdate: options.pendingHypotheses || [],
    familyInteractionCyclesToCreateOrUpdate: options.interactionCycles || diagnosisInteractionCycles,
    parentNarrativePatternsToUpdate: [],
    dailyInteractionUpdatesToWrite: options.dailyUpdates || [],
    retrievalTagsToAdd: options.retrievalIndexes || [],
    oldItemsToSupersede: options.oldItemsToSupersede || [],
    itemsNotToWriteAsStableMemory: options.itemsNotToWrite || [],
    writeRationale: options.rationale || {
      whyUpdate: '',
      whyNotPromoteSomeItems: '',
      riskOfOvergeneralization: '',
      nextVerificationNeed: ''
    }
  }
}

export async function executeWritePlan(plan: MemoryWritePlan, tenant: TenantId) {
  if (plan.rawMaterialsToWrite.length > 0) {
    await saveRawMaterials(plan.rawMaterialsToWrite, tenant)
    const materialIndexes = plan.rawMaterialsToWrite.map(m => buildIndexesForMaterial(m, tenant))
    await saveRetrievalIndexes(materialIndexes, tenant)
  }

  if (plan.cleanedFactsToWrite.length > 0) {
    await saveCleanedFacts(plan.cleanedFactsToWrite, tenant)
  }

  for (const pack of plan.entryEvidencePacksToUpdate) {
    await saveEntryEvidencePack(pack, tenant)
    await saveRetrievalIndexes([buildIndexesForEvidencePack(pack, tenant)], tenant)
  }

  for (const network of plan.crossEntryNetworksToUpdate) {
    await saveEvidenceNetwork(network, tenant)
  }

  for (const model of plan.childStructureModelsToCreateOrUpdate) {
    await saveChildStructureModel(model, tenant)
    if (model.primaryConditionalProfile) {
      await saveConditionalProfile(model.primaryConditionalProfile, tenant)
    }
    for (const profile of model.secondaryConditionalProfiles) {
      await saveConditionalProfile(profile, tenant)
    }
  }

  if (plan.pendingHypothesesToCreateOrUpdate.length > 0) {
    await savePendingHypotheses(plan.pendingHypothesesToCreateOrUpdate, tenant)
  }

  if (plan.familyInteractionCyclesToCreateOrUpdate.length > 0) {
    await saveFamilyInteractionCycles(plan.familyInteractionCyclesToCreateOrUpdate, tenant)
  }

  for (const update of plan.dailyInteractionUpdatesToWrite) {
    await saveDailyInteractionUpdate(update, tenant)
    await saveRetrievalIndexes([buildIndexesForDailyUpdate(update, tenant)], tenant)
  }

  if (plan.retrievalTagsToAdd.length > 0) {
    await saveRetrievalIndexes(plan.retrievalTagsToAdd, tenant)
  }
}

export function createDailyUpdate(input: string, classification: InputClassification, matchedMechanisms: string[], tenant: TenantId, sourceEventId?: string): DailyInteractionUpdate {
  return {
    updateId: createId('update'),
    familyId: tenant.familyId,
    childId: tenant.childId,
    newInput: input,
    classification,
    matchedMechanisms,
    relatedEvidence: [],
    recommendedResponseLogic: '',
    memoryImpact: classification === 'counter_evidence' ? 'decrease_strength' : 'increase_strength',
    updatedTargets: [],
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    sourceEventId
  }
}

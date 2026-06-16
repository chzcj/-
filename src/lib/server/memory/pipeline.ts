import type {
  MemoryWritePlan,
  DailyDialogueRetrievalPacket,
  DiagnosisRetrievalPacket,
  EntryCollectionRetrievalPacket,
  SynthesisRetrievalPacket,
  EntryName
} from '@/types/database'
import { buildMemoryWritePlan, executeWritePlan, createDailyUpdate, classifyInputForMemory } from './write/decision-engine'
import {
  buildDailyDialogueRetrievalPacket,
  buildDiagnosisRetrievalPacket,
  buildEntryCollectionRetrievalPacket,
  buildSynthesisRetrievalPacket
} from './retrieval/router'
import type { TenantId } from './tenant'

/* ================================================================
   Memory Pipeline — 记忆沉淀与检索 Agent 编排入口
   ================================================================ */

export async function runMemoryWritePipeline(plan: MemoryWritePlan, tenant: TenantId): Promise<{ ok: boolean; written: number }> {
  try {
    await executeWritePlan(plan, tenant)
    const counts = plan.rawMaterialsToWrite.length +
      plan.cleanedFactsToWrite.length +
      plan.entryEvidencePacksToUpdate.length +
      plan.crossEntryNetworksToUpdate.length +
      plan.childStructureModelsToCreateOrUpdate.length +
      plan.pendingHypothesesToCreateOrUpdate.length +
      plan.familyInteractionCyclesToCreateOrUpdate.length +
      plan.dailyInteractionUpdatesToWrite.length
    return { ok: true, written: counts }
  } catch (e) {
    return { ok: false, written: 0 }
  }
}

export async function runMemoryRetrievePipeline(
  purpose: 'daily_dialogue' | 'deep_diagnosis' | 'entry_collection' | 'multi_entry_synthesis',
  tenant: TenantId,
  targetEntry?: EntryName
): Promise<DailyDialogueRetrievalPacket | DiagnosisRetrievalPacket | EntryCollectionRetrievalPacket | SynthesisRetrievalPacket> {
  switch (purpose) {
    case 'daily_dialogue':
      return await buildDailyDialogueRetrievalPacket(undefined, tenant)
    case 'deep_diagnosis':
      return await buildDiagnosisRetrievalPacket(tenant)
    case 'entry_collection':
      return await buildEntryCollectionRetrievalPacket(targetEntry || 'learning_homework', tenant)
    case 'multi_entry_synthesis':
      return await buildSynthesisRetrievalPacket(tenant)
  }
}

export {
  buildMemoryWritePlan,
  executeWritePlan,
  createDailyUpdate,
  classifyInputForMemory
}

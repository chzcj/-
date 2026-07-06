import 'server-only'

import { loadMemoryLayerItemById, upsertMemoryLayerItems } from '@/lib/server/db'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { StructuralTension } from '@/types/deep-model-digest'
import type { EcosystemLayer } from '@/types/database'

const LAYER = 'deep_mechanism_handoffs'
const ITEM_ID = 'latest'

export type ClassifiedFact = {
  factId: string
  text: string
  entryName: string
  layers: EcosystemLayer[]
}

export type TheoryMatchHandoff = {
  theoryCardId: string
  theoryName: string
  ecosystemLayer: EcosystemLayer
  confidence: 'low' | 'medium' | 'high'
  matchedFactIds: string[]
  rationale: string
}

export type DeepMechanismHandoff = {
  ecosystemMap: ClassifiedFact[]
  theoryMatches: TheoryMatchHandoff[]
  structuralTensions: StructuralTension[]
  updatedAt: string
}

export async function loadDeepMechanismHandoff(tenant: TenantId): Promise<DeepMechanismHandoff | null> {
  const item = await loadMemoryLayerItemById<DeepMechanismHandoff>(
    LAYER,
    ITEM_ID,
    tenant.familyId,
    tenant.childId
  ).catch(() => undefined)
  return item ?? null
}

export async function saveDeepMechanismHandoff(handoff: DeepMechanismHandoff, tenant: TenantId): Promise<void> {
  await upsertMemoryLayerItems(
    LAYER,
    [
      {
        itemId: ITEM_ID,
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: handoff,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

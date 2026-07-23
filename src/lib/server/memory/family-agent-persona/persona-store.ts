import 'server-only'

import {
  loadMemoryLayerItemById,
  upsertMemoryLayerItems,
} from '@/lib/server/db'
import type { FamilyAgentPersona } from '@/types/database'
import type { TenantId } from '@/lib/server/memory/tenant'

const LAYER = 'family_agent_persona'
const ITEM_ID = 'latest'

export async function loadFamilyAgentPersona(tenant: TenantId): Promise<FamilyAgentPersona | null> {
  const item = await loadMemoryLayerItemById<FamilyAgentPersona>(
    LAYER,
    ITEM_ID,
    tenant.familyId,
    tenant.childId
  ).catch(() => undefined)
  return item ?? null
}

export async function saveFamilyAgentPersona(persona: FamilyAgentPersona, tenant: TenantId): Promise<void> {
  await upsertMemoryLayerItems(
    LAYER,
    [
      {
        itemId: ITEM_ID,
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: persona,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

export function buildDefaultPersona(familyId: string): FamilyAgentPersona {
  return {
    familyId,
    parentTraits: {
      anxietyLevel: 0.5,
      controlTendency: 0.5,
      reflectivity: 0.5,
    },
    childTraits: {
      ageStage: 'unknown',
      temperament: 'unknown',
    },
    familyClimate: {
      conflictFrequency: 0.3,
      supportLevel: 0.5,
    },
    toneCalibration: 'gentle',
    questionStrategy: 'probe_feeling',
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

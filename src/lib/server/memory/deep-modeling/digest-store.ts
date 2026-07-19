import 'server-only'

import {
  loadMemoryLayerItemById,
  loadMemoryLayerItemsByIdPrefix,
  upsertMemoryLayerItems,
} from '@/lib/server/db'
import type { DeepModelDigest } from '@/types/deep-model-digest'
import type { FamilyUnderstandingDossier } from '@/types/family-understanding-dossier'
import { EMPTY_DOSSIER } from '@/types/family-understanding-dossier'
import type { TenantId } from '@/lib/server/memory/tenant'

const LAYER = 'deep_model_digest'
const ITEM_ID = 'latest'

export async function loadDeepModelDigest(tenant: TenantId): Promise<DeepModelDigest | null> {
  const item = await loadMemoryLayerItemById<DeepModelDigest>(
    LAYER,
    ITEM_ID,
    tenant.familyId,
    tenant.childId
  ).catch(() => undefined)
  return item ?? null
}

export async function getLatestDossier(tenant: TenantId): Promise<FamilyUnderstandingDossier | null> {
  const digest = await loadDeepModelDigest(tenant)
  return digest?.dossier ?? null
}

export async function getDossierHistory(tenant: TenantId): Promise<FamilyUnderstandingDossier[]> {
  const items = await loadMemoryLayerItemsByIdPrefix<FamilyUnderstandingDossier>(
    LAYER,
    'dossier_v',
    tenant.familyId,
    tenant.childId
  ).catch(() => undefined)
  if (!items) return []
  return items
    .filter((d) => typeof d.version === 'number' && d.version > 0 && Boolean(d.workingHypothesis?.text))
    .sort((a, b) => (a.version || 0) - (b.version || 0))
}

export async function saveDeepModelDigest(digest: DeepModelDigest, tenant: TenantId): Promise<void> {
  await upsertMemoryLayerItems(
    LAYER,
    [
      {
        itemId: ITEM_ID,
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: digest,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

/** 追加 dossier 版本 + 更新 latest 指针（schema v2） */
export async function saveDossierVersion(
  dossier: FamilyUnderstandingDossier,
  tenant: TenantId,
  baseDigest?: DeepModelDigest | null
): Promise<void> {
  const prev = baseDigest ?? (await loadDeepModelDigest(tenant))
  const version = dossier.version || (await getDossierHistory(tenant)).length + 1
  const normalized: FamilyUnderstandingDossier = {
    ...EMPTY_DOSSIER,
    ...dossier,
    version,
    updatedAt: dossier.updatedAt || new Date().toISOString(),
  }

  const digest: DeepModelDigest = {
    ...(prev || {
      mechanismNarrative: '',
      interactionLoops: [],
      anchoredFacts: [],
      parentVerbatimSnippets: [],
      childQuotes: [],
      openHypotheses: [],
      cultivationFocus: '',
      structuralTensions: [],
      updatedAt: '',
      source: 'deterministic' as const,
    }),
    schemaVersion: 2,
    dossier: normalized,
    mechanismNarrative: normalized.integratedSynthesis?.trim() || prev?.mechanismNarrative || '',
    updatedAt: normalized.updatedAt,
    source: 'llm',
  }

  await upsertMemoryLayerItems(
    LAYER,
    [
      {
        itemId: `dossier_v${version}`,
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: normalized,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
  await upsertMemoryLayerItems(
    LAYER,
    [
      {
        itemId: ITEM_ID,
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: digest,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

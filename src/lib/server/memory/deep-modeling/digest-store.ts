import 'server-only'

import {
  loadMemoryLayerItemById,
  loadMemoryLayerItemsByIdPrefix,
  upsertMemoryLayerItems,
} from '@/lib/server/db'
import { embedTexts, isEmbeddingEnabled } from '@/lib/server/memory/embedding'
import type { DeepModelDigest } from '@/types/deep-model-digest'
import type { FamilyUnderstandingDossier } from '@/types/family-understanding-dossier'
import { EMPTY_DOSSIER } from '@/types/family-understanding-dossier'
import type { TenantId } from '@/lib/server/memory/tenant'

const LAYER = 'deep_model_digest'
const ITEM_ID = 'latest'
const EMB_ITEM_ID = 'component_embeddings'

/* ================================================================
   v4.1 语义激活：dossier 组件 embedding 独立存储（不混入 dossier JSON，
   防止向量随 previousDossier 灌进 LLM payload 撑爆 prompt）。
   落库时预计算，检索时零额外 embedding 成本（只需 embed query）。
   ================================================================ */

export type DossierComponentKind = 'scene' | 'perpetuating' | 'protective' | 'parentPerspective' | 'intervention'

export interface DossierComponentEmbedding {
  /** 稳定键：`${kind}:${index}`，index 对应 dossier 数组下标 */
  key: string
  kind: DossierComponentKind
  index: number
  text: string
  embedding: number[]
}

export interface DossierComponentEmbeddingPack {
  dossierVersion: number
  items: DossierComponentEmbedding[]
  updatedAt: string
}

/** 从 dossier 抽取参与语义激活的组件文本 */
function extractComponentTexts(
  dossier: FamilyUnderstandingDossier
): Array<{ key: string; kind: DossierComponentKind; index: number; text: string }> {
  const out: Array<{ key: string; kind: DossierComponentKind; index: number; text: string }> = []
  dossier.sceneReadings.forEach((s, i) => {
    const text = `${s.scene}：${s.reading}`.trim()
    if (text.length > 3) out.push({ key: `scene:${i}`, kind: 'scene', index: i, text })
  })
  ;(dossier.fivePs.perpetuating || []).forEach((f, i) => {
    const text = `${f.label} ${f.evidenceSummary || ''}`.trim()
    if (text.length > 3) out.push({ key: `perpetuating:${i}`, kind: 'perpetuating', index: i, text })
  })
  ;(dossier.fivePs.protective || []).forEach((f, i) => {
    const text = `${f.label} ${f.evidenceSummary || ''}`.trim()
    if (text.length > 3) out.push({ key: `protective:${i}`, kind: 'protective', index: i, text })
  })
  dossier.parentPerspectives.forEach((p, i) => {
    const text = [p.role, p.intent, p.childReception, p.blindSpot].filter(Boolean).join(' ').trim()
    if (text.length > 3) out.push({ key: `parentPerspective:${i}`, kind: 'parentPerspective', index: i, text })
  })
  dossier.interventionTargets.forEach((t, i) => {
    if (t.action?.trim()) out.push({ key: `intervention:${i}`, kind: 'intervention', index: i, text: t.action.trim() })
  })
  return out
}

export async function loadDossierComponentEmbeddings(
  tenant: TenantId
): Promise<DossierComponentEmbeddingPack | null> {
  const item = await loadMemoryLayerItemById<DossierComponentEmbeddingPack>(
    LAYER,
    EMB_ITEM_ID,
    tenant.familyId,
    tenant.childId
  ).catch(() => undefined)
  return item ?? null
}

/** 预计算并保存组件 embedding；embedding 不可用/失败时静默跳过（语义激活自动回退正则） */
async function saveDossierComponentEmbeddings(
  dossier: FamilyUnderstandingDossier,
  tenant: TenantId
): Promise<void> {
  if (!isEmbeddingEnabled()) return
  const components = extractComponentTexts(dossier)
  if (components.length === 0) return
  const vectors = await embedTexts(components.map((c) => c.text))
  const items: DossierComponentEmbedding[] = components
    .map((c, i) => ({ ...c, embedding: vectors[i] }))
    .filter((c): c is DossierComponentEmbedding => Array.isArray(c.embedding) && c.embedding.length > 0)
  if (items.length === 0) return
  const pack: DossierComponentEmbeddingPack = {
    dossierVersion: dossier.version,
    items,
    updatedAt: new Date().toISOString(),
  }
  await upsertMemoryLayerItems(
    LAYER,
    [{ itemId: EMB_ITEM_ID, familyId: tenant.familyId, childId: tenant.childId, data: pack }],
    tenant.familyId,
    tenant.childId
  )
}

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
  // v4.1：组件 embedding 随版本刷新（失败不阻断 dossier 落库）
  await saveDossierComponentEmbeddings(normalized, tenant).catch((err) =>
    console.warn('[digest-store] 组件 embedding 计算失败，语义激活将回退正则:', err)
  )
}

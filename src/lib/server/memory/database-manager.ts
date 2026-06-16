import type {
  RawMaterial,
  CleanedFact,
  EntryEvidencePack,
  CrossEntryEvidenceNetwork,
  ChildStructureModel,
  ConditionalProfile,
  PendingHypothesis,
  FamilyInteractionCycle,
  ParentNarrativePattern,
  DailyInteractionUpdate,
  RetrievalIndex,
  EntryName
} from '@/types/database'
import {
  isDatabaseEnabled,
  loadMemoryLayerItems,
  replaceMemoryLayerItems,
  upsertMemoryLayerItems,
  debugMemoryLayerItemCounts
} from '@/lib/server/db'

/* ================================================================
   10-Layer Database Manager
   服务器端优先写入 PostgreSQL；仅在未启用 DB 时降级到进程内存。
   ================================================================ */

const MEMORY_PREFIX = 'childos.memory.v1'
const DEFAULT_FAMILY_ID = 'family_demo'
const DEFAULT_CHILD_ID = 'child_demo'

type ServerMemoryStore = Record<string, unknown[]>
type MemoryItem<T> = { itemId: string; familyId?: string; childId?: string; data: T }

function getServerMemoryStore(): ServerMemoryStore {
  const globalStore = globalThis as typeof globalThis & { __childosServerMemoryStore?: ServerMemoryStore }
  if (!globalStore.__childosServerMemoryStore) {
    // 首次降级到进程内存时显式告警一次，避免静默掩盖「数据未持久化」（交付文档 10.4）。
    if (!isDatabaseEnabled()) {
      console.warn('[childos] ⚠️ 数据库未启用（DATABASE_URL 未配置或 NEXT_PUBLIC_USE_MOCK!=false），记忆数据写入进程内存，进程重启后将丢失。生产环境请配置持久化数据库。')
    }
    globalStore.__childosServerMemoryStore = {}
  }
  return globalStore.__childosServerMemoryStore
}

function readClientLayer<T>(layerName: string): T[] {
  if (typeof window === 'undefined') return (getServerMemoryStore()[layerName] as T[] | undefined) || []
  try {
    const raw = localStorage.getItem(`${MEMORY_PREFIX}.${layerName}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeClientLayer<T>(layerName: string, data: T[]) {
  if (typeof window === 'undefined') {
    getServerMemoryStore()[layerName] = data as unknown[]
    return
  }
  try {
    localStorage.setItem(`${MEMORY_PREFIX}.${layerName}`, JSON.stringify(data))
  } catch {
    /* quota exceeded — silently fail */
  }
}

async function readLayer<T>(layerName: string): Promise<T[]> {
  if (typeof window === 'undefined' && isDatabaseEnabled()) {
    const rows = await loadMemoryLayerItems<T>(layerName, DEFAULT_FAMILY_ID, DEFAULT_CHILD_ID)
    return rows || []
  }
  return readClientLayer<T>(layerName)
}

async function replaceLayer<T>(layerName: string, items: MemoryItem<T>[]) {
  if (typeof window === 'undefined' && isDatabaseEnabled()) {
    await replaceMemoryLayerItems(layerName, items, DEFAULT_FAMILY_ID, DEFAULT_CHILD_ID)
    return
  }
  writeClientLayer(layerName, items.map(item => item.data))
}

async function upsertLayer<T>(layerName: string, items: MemoryItem<T>[]) {
  if (items.length === 0) return
  if (typeof window === 'undefined' && isDatabaseEnabled()) {
    await upsertMemoryLayerItems(layerName, items, DEFAULT_FAMILY_ID, DEFAULT_CHILD_ID)
    return
  }
  const existing = readClientLayer<T>(layerName)
  const byId = new Map<string, T>()
  for (const item of existing) byId.set(getItemId(layerName, item), item)
  for (const item of items) byId.set(item.itemId, item.data)
  writeClientLayer(layerName, [...byId.values()])
}

function getFamilyId(value: unknown): string {
  return typeof value === 'object' && value !== null && 'familyId' in value && typeof value.familyId === 'string'
    ? value.familyId
    : DEFAULT_FAMILY_ID
}

function getChildId(value: unknown): string {
  return typeof value === 'object' && value !== null && 'childId' in value && typeof value.childId === 'string'
    ? value.childId
    : DEFAULT_CHILD_ID
}

function toItem<T>(layerName: string, data: T, itemId = getItemId(layerName, data)): MemoryItem<T> {
  return {
    itemId,
    familyId: getFamilyId(data),
    childId: getChildId(data),
    data
  }
}

function getItemId(layerName: string, value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    const explicitId =
      record.materialId ||
      record.factId ||
      record.packId ||
      record.networkId ||
      record.modelId ||
      record.profileId ||
      record.hypothesisId ||
      record.cycleId ||
      record.patternId ||
      record.updateId ||
      record.indexId

    if (typeof explicitId === 'string' && explicitId.trim()) return explicitId
    if (layerName === 'entry_evidence_packs' && typeof record.entryName === 'string') return `entry:${record.entryName}`
    if (layerName === 'child_structure_models') return `${getFamilyId(value)}:${getChildId(value)}:latest`
    if (layerName === 'parent_narrative_patterns') return `${getFamilyId(value)}:${getChildId(value)}:latest`
  }
  return `${layerName}:${Date.now()}:${Math.random().toString(16).slice(2)}`
}

/* ================================================================
   L1: RawMaterial
   ================================================================ */
export async function saveRawMaterials(materials: RawMaterial[]) {
  await upsertLayer('raw_materials', materials.map(material => toItem('raw_materials', material)))
}

export async function getRawMaterials(): Promise<RawMaterial[]> {
  return readLayer<RawMaterial>('raw_materials')
}

/* ================================================================
   L2: CleanedFact
   ================================================================ */
export async function saveCleanedFacts(facts: CleanedFact[]) {
  await upsertLayer('cleaned_facts', facts.map(fact => toItem('cleaned_facts', fact)))
}

export async function getCleanedFacts(): Promise<CleanedFact[]> {
  return readLayer<CleanedFact>('cleaned_facts')
}

/* ================================================================
   L3: EntryEvidencePack
   ================================================================ */
export async function saveEntryEvidencePack(pack: EntryEvidencePack) {
  await upsertLayer('entry_evidence_packs', [toItem('entry_evidence_packs', pack, `entry:${pack.entryName}`)])
}

export async function getEntryEvidencePacks(): Promise<EntryEvidencePack[]> {
  return readLayer<EntryEvidencePack>('entry_evidence_packs')
}

export async function getEntryEvidencePack(entryName: EntryName): Promise<EntryEvidencePack | null> {
  return (await readLayer<EntryEvidencePack>('entry_evidence_packs')).find(p => p.entryName === entryName) || null
}

export async function getAllEntryCompletion(): Promise<Record<EntryName, boolean>> {
  const packs = await getEntryEvidencePacks()
  return {
    learning_homework: packs.some(p => p.entryName === 'learning_homework'),
    daily_rhythm_phone: packs.some(p => p.entryName === 'daily_rhythm_phone'),
    parent_child_communication: packs.some(p => p.entryName === 'parent_child_communication'),
    emotional_stress: packs.some(p => p.entryName === 'emotional_stress'),
    relationship_environment: packs.some(p => p.entryName === 'relationship_environment')
  }
}

/* ================================================================
   L4: CrossEntryEvidenceNetwork
   ================================================================ */
export async function saveEvidenceNetwork(network: CrossEntryEvidenceNetwork) {
  await upsertLayer('evidence_networks', [toItem('evidence_networks', network)])
}

export async function getLatestEvidenceNetwork(): Promise<CrossEntryEvidenceNetwork | null> {
  return (await readLayer<CrossEntryEvidenceNetwork>('evidence_networks')).slice(-1)[0] || null
}

/* ================================================================
   L5: ChildStructureModel
   ================================================================ */
export async function saveChildStructureModel(model: ChildStructureModel) {
  await replaceLayer('child_structure_models', [toItem('child_structure_models', model, `${model.familyId}:${model.childId}:latest`)])
}

export async function getLatestChildStructureModel(): Promise<ChildStructureModel | null> {
  return (await readLayer<ChildStructureModel>('child_structure_models')).slice(-1)[0] || null
}

export async function saveConditionalProfile(profile: ConditionalProfile) {
  await upsertLayer('conditional_profiles', [toItem('conditional_profiles', profile)])
}

export async function getConditionalProfiles(): Promise<ConditionalProfile[]> {
  return readLayer<ConditionalProfile>('conditional_profiles')
}

/* ================================================================
   L6: PendingHypothesis
   ================================================================ */
export async function savePendingHypotheses(hypotheses: PendingHypothesis[]) {
  await upsertLayer('pending_hypotheses', hypotheses.map(hypothesis => toItem('pending_hypotheses', hypothesis)))
}

export async function getPendingHypotheses(): Promise<PendingHypothesis[]> {
  return readLayer<PendingHypothesis>('pending_hypotheses')
}

export async function updateHypothesisWeight(hypothesisId: string, newWeight: PendingHypothesis['weight']) {
  const hyps = await readLayer<PendingHypothesis>('pending_hypotheses')
  const target = hyps.find(h => h.hypothesisId === hypothesisId)
  if (target) {
    target.weight = newWeight
    target.updatedAt = new Date().toISOString()
    await upsertLayer('pending_hypotheses', [toItem('pending_hypotheses', target)])
  }
}

/* ================================================================
   L7: FamilyInteractionCycle
   ================================================================ */
export async function saveFamilyInteractionCycles(cycles: FamilyInteractionCycle[]) {
  await upsertLayer('interaction_cycles', cycles.map(cycle => toItem('interaction_cycles', cycle)))
}

export async function getFamilyInteractionCycles(): Promise<FamilyInteractionCycle[]> {
  return readLayer<FamilyInteractionCycle>('interaction_cycles')
}

/* ================================================================
   L8: ParentNarrativePattern
   ================================================================ */
export async function saveParentNarrativePattern(pattern: ParentNarrativePattern) {
  await replaceLayer('parent_narrative_patterns', [toItem('parent_narrative_patterns', pattern, `${pattern.familyId}:${pattern.childId}:latest`)])
}

export async function getParentNarrativePattern(): Promise<ParentNarrativePattern | null> {
  return (await readLayer<ParentNarrativePattern>('parent_narrative_patterns')).slice(-1)[0] || null
}

/* ================================================================
   L9: DailyInteractionUpdate
   ================================================================ */
export async function saveDailyInteractionUpdate(update: DailyInteractionUpdate) {
  await upsertLayer('daily_updates', [toItem('daily_updates', update)])
}

export async function getDailyInteractionUpdates(): Promise<DailyInteractionUpdate[]> {
  return readLayer<DailyInteractionUpdate>('daily_updates')
}

/* ================================================================
   L10: RetrievalIndex
   ================================================================ */
export async function saveRetrievalIndexes(indexes: RetrievalIndex[]) {
  await upsertLayer('retrieval_indexes', indexes.map(index => toItem('retrieval_indexes', index)))
}

export async function getRetrievalIndexes(): Promise<RetrievalIndex[]> {
  return readLayer<RetrievalIndex>('retrieval_indexes')
}

export async function getRetrievalIndexesByTag(tag: string): Promise<RetrievalIndex[]> {
  return (await readLayer<RetrievalIndex>('retrieval_indexes')).filter(
    i => i.sceneTags.includes(tag) || i.mechanismTags.includes(tag)
  )
}

/* ================================================================
   Debug / Reset
   ================================================================ */
export async function debugMemoryLayerCounts(): Promise<Record<string, number>> {
  if (typeof window === 'undefined' && isDatabaseEnabled()) {
    const counts = await debugMemoryLayerItemCounts()
    return {
      rawMaterials: counts?.raw_materials || 0,
      cleanedFacts: counts?.cleaned_facts || 0,
      entryEvidencePacks: counts?.entry_evidence_packs || 0,
      evidenceNetworks: counts?.evidence_networks || 0,
      childStructureModels: counts?.child_structure_models || 0,
      conditionalProfiles: counts?.conditional_profiles || 0,
      pendingHypotheses: counts?.pending_hypotheses || 0,
      interactionCycles: counts?.interaction_cycles || 0,
      parentNarrativePatterns: counts?.parent_narrative_patterns || 0,
      dailyUpdates: counts?.daily_updates || 0,
      retrievalIndexes: counts?.retrieval_indexes || 0
    }
  }

  return {
    rawMaterials: (await getRawMaterials()).length,
    cleanedFacts: (await getCleanedFacts()).length,
    entryEvidencePacks: (await getEntryEvidencePacks()).length,
    evidenceNetworks: (await readLayer('evidence_networks')).length,
    childStructureModels: (await readLayer('child_structure_models')).length,
    conditionalProfiles: (await getConditionalProfiles()).length,
    pendingHypotheses: (await getPendingHypotheses()).length,
    interactionCycles: (await getFamilyInteractionCycles()).length,
    parentNarrativePatterns: (await readLayer('parent_narrative_patterns')).length,
    dailyUpdates: (await getDailyInteractionUpdates()).length,
    retrievalIndexes: (await getRetrievalIndexes()).length
  }
}

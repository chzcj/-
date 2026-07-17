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
  EntryName,
  TurnEvent,
  UserTask,
} from '@/types/database'
import {
  isDatabaseEnabled,
  loadMemoryLayerItems,
  loadMemoryLayerItemById,
  replaceMemoryLayerItems,
  upsertMemoryLayerItems,
  debugMemoryLayerItemCounts
} from '@/lib/server/db'
import type { TenantId } from './tenant'

/* ================================================================
   10-Layer Database Manager（多租户）
   服务器端优先写入 PostgreSQL；仅在未启用 DB 时降级到进程内存。
   所有读写按 tenant(familyId/childId) 隔离——进程内存与 DB 两条路径同源。
   ================================================================ */

const MEMORY_PREFIX = 'childos.memory.v1'

// 进程内存 store 按租户分桶：__childosServerMemoryStore[`${familyId}:${childId}`][layerName] = unknown[]
type ServerMemoryStore = Record<string, Record<string, unknown[]>>
type MemoryItem<T> = { itemId: string; familyId: string; childId: string; data: T }

function tenantKey(t: TenantId): string {
  return `${t.familyId}:${t.childId}`
}

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

function readClientLayer<T>(layerName: string, t: TenantId): T[] {
  if (typeof window === 'undefined') {
    return (getServerMemoryStore()[tenantKey(t)]?.[layerName] as T[] | undefined) || []
  }
  try {
    const raw = localStorage.getItem(`${MEMORY_PREFIX}.${tenantKey(t)}.${layerName}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeClientLayer<T>(layerName: string, data: T[], t: TenantId) {
  if (typeof window === 'undefined') {
    const store = getServerMemoryStore()
    ;(store[tenantKey(t)] ||= {})[layerName] = data as unknown[]
    return
  }
  try {
    localStorage.setItem(`${MEMORY_PREFIX}.${tenantKey(t)}.${layerName}`, JSON.stringify(data))
  } catch {
    /* quota exceeded — silently fail */
  }
}

async function readLayer<T>(layerName: string, t: TenantId): Promise<T[]> {
  if (typeof window === 'undefined' && isDatabaseEnabled()) {
    const rows = await loadMemoryLayerItems<T>(layerName, t.familyId, t.childId)
    return rows || []
  }
  return readClientLayer<T>(layerName, t)
}

async function replaceLayer<T>(layerName: string, items: MemoryItem<T>[], t: TenantId) {
  if (typeof window === 'undefined' && isDatabaseEnabled()) {
    await replaceMemoryLayerItems(layerName, items, t.familyId, t.childId)
    return
  }
  writeClientLayer(layerName, items.map(item => item.data), t)
}

async function upsertLayer<T>(layerName: string, items: MemoryItem<T>[], t: TenantId) {
  if (items.length === 0) return
  if (typeof window === 'undefined' && isDatabaseEnabled()) {
    await upsertMemoryLayerItems(layerName, items, t.familyId, t.childId)
    return
  }
  const existing = readClientLayer<T>(layerName, t)
  const byId = new Map<string, T>()
  for (const item of existing) byId.set(getItemId(layerName, item, t), item)
  for (const item of items) byId.set(item.itemId, item.data)
  writeClientLayer(layerName, [...byId.values()], t)
}

// itemId 由 tenant 决定：单例层(latest)与 entry_evidence_packs 必须带租户前缀，否则跨租户撞 PK。
function getItemId(layerName: string, value: unknown, t: TenantId): string {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    const explicitId =
      record.materialId ||
      record.factId ||
      record.networkId ||
      record.profileId ||
      record.hypothesisId ||
      record.cycleId ||
      record.updateId ||
      record.indexId ||
      record.taskId ||
      record.taskId

    if (typeof explicitId === 'string' && explicitId.trim()) return explicitId
    if (layerName === 'entry_evidence_packs' && typeof record.entryName === 'string') {
      return `${t.familyId}:${t.childId}:entry:${record.entryName}`
    }
    if (layerName === 'child_structure_models') return `${t.familyId}:${t.childId}:latest`
    if (layerName === 'parent_narrative_patterns') return `${t.familyId}:${t.childId}:latest`
  }
  return `${layerName}:${Date.now()}:${Math.random().toString(16).slice(2)}`
}

function toItem<T>(layerName: string, data: T, t: TenantId, itemId = getItemId(layerName, data, t)): MemoryItem<T> {
  return { itemId, familyId: t.familyId, childId: t.childId, data }
}

/* ================================================================
   L1: RawMaterial
   ================================================================ */
export async function saveRawMaterials(materials: RawMaterial[], tenant: TenantId) {
  await upsertLayer('raw_materials', materials.map(material => toItem('raw_materials', material, tenant)), tenant)
}

export async function getRawMaterials(tenant: TenantId): Promise<RawMaterial[]> {
  return readLayer<RawMaterial>('raw_materials', tenant)
}

/* ================================================================
   L2: CleanedFact
   ================================================================ */
export async function saveCleanedFacts(facts: CleanedFact[], tenant: TenantId) {
  await upsertLayer('cleaned_facts', facts.map(fact => toItem('cleaned_facts', fact, tenant)), tenant)
}

export async function getCleanedFacts(tenant: TenantId): Promise<CleanedFact[]> {
  return readLayer<CleanedFact>('cleaned_facts', tenant)
}

/* ================================================================
   L3: EntryEvidencePack
   ================================================================ */
export async function saveEntryEvidencePack(pack: EntryEvidencePack, tenant: TenantId) {
  const itemId = `${tenant.familyId}:${tenant.childId}:entry:${pack.entryName}`
  await upsertLayer('entry_evidence_packs', [toItem('entry_evidence_packs', pack, tenant, itemId)], tenant)
}

export async function getEntryEvidencePacks(tenant: TenantId): Promise<EntryEvidencePack[]> {
  return readLayer<EntryEvidencePack>('entry_evidence_packs', tenant)
}

export async function getEntryEvidencePack(entryName: EntryName, tenant: TenantId): Promise<EntryEvidencePack | null> {
  return (await readLayer<EntryEvidencePack>('entry_evidence_packs', tenant)).find(p => p.entryName === entryName) || null
}

export async function getAllEntryCompletion(tenant: TenantId): Promise<Record<EntryName, boolean>> {
  const packs = await getEntryEvidencePacks(tenant)
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
export async function saveEvidenceNetwork(network: CrossEntryEvidenceNetwork, tenant: TenantId) {
  await upsertLayer('evidence_networks', [toItem('evidence_networks', network, tenant)], tenant)
}

export async function getLatestEvidenceNetwork(tenant: TenantId): Promise<CrossEntryEvidenceNetwork | null> {
  return (await readLayer<CrossEntryEvidenceNetwork>('evidence_networks', tenant)).slice(-1)[0] || null
}

/* ================================================================
   L5: ChildStructureModel
   ================================================================ */
export async function saveChildStructureModel(model: ChildStructureModel, tenant: TenantId) {
  await replaceLayer('child_structure_models', [toItem('child_structure_models', model, tenant, `${tenant.familyId}:${tenant.childId}:latest`)], tenant)
}

export async function getLatestChildStructureModel(tenant: TenantId): Promise<ChildStructureModel | null> {
  return (await readLayer<ChildStructureModel>('child_structure_models', tenant)).slice(-1)[0] || null
}

/* 首次建模生成的孩子画像快照（前台 /profile/result 渲染用）。
   持久化到 DB（按租户隔离），让画像跨设备/重装不丢——前台 localStorage 仅作本机缓存。 */
export type BuiltProfileSnapshot = {
  completeness: number
  coreJudgment: string
  deepMechanism: string
  supportFocus?: string
  evidence: Array<{ sourceLabel: string; evidenceText: string; explanation: string; strength: 'weak' | 'medium' | 'strong' }>
  verificationPoints: Array<{ title: string; description: string }>
  updatedAt: string
}

export async function saveBuiltProfileSnapshot(snapshot: BuiltProfileSnapshot, tenant: TenantId) {
  await replaceLayer('built_profile_snapshots', [toItem('built_profile_snapshots', snapshot, tenant, `${tenant.familyId}:${tenant.childId}:latest`)], tenant)
}

export async function getLatestBuiltProfileSnapshot(tenant: TenantId): Promise<BuiltProfileSnapshot | null> {
  return (await readLayer<BuiltProfileSnapshot>('built_profile_snapshots', tenant)).slice(-1)[0] || null
}

export type RemoteBuildState = {
  introSeen: boolean
  basicInfoDone: boolean
  completedEntries: string[]
  stageSummaries: Array<{
    entryType: string
    mainJudgment: string
    facts: string[]
    pendingHypotheses: string[]
    note?: string
    familyMap?: string
    sufficient?: boolean
  }>
  updatedAt: string
}

export async function saveBuildProgress(state: RemoteBuildState, tenant: TenantId) {
  await replaceLayer(
    'build_progress',
    [toItem('build_progress', state, tenant, `${tenant.familyId}:${tenant.childId}:latest`)],
    tenant
  )
}

export async function getBuildProgress(tenant: TenantId): Promise<RemoteBuildState | null> {
  return (await readLayer<RemoteBuildState>('build_progress', tenant)).slice(-1)[0] || null
}

export type ProfileBuildRunStage = 'synthesis' | 'diagnosis' | 'persist' | 'readiness'
export type ProfileBuildRunStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export type ProfileBuildRun = {
  runId: string
  inputVersion: string
  status: ProfileBuildRunStatus
  phase: number
  label: string
  currentStage?: ProfileBuildRunStage
  failedStage?: ProfileBuildRunStage
  error?: string
  startedAt: string
  updatedAt: string
  completedAt?: string
  inputPurged?: boolean
}

export type ProfileBuildInputSnapshot = {
  inputVersion: string
  finalFollowUpText: string
  entryMap: Record<
    string,
    {
      rawTexts: string[]
      followUps: string[]
      stageSummary?: string
      aiFacts?: string[]
      aiHypotheses?: string[]
      moduleComplete?: boolean
      summarySufficient?: boolean
    }
  >
  createdAt: string
}

type ProfileBuildStageCache = {
  inputVersion: string
  synthesis?: Record<string, unknown>
  diagnosis?: Record<string, unknown>
  updatedAt: string
}

export async function saveProfileBuildInputSnapshot(snapshot: ProfileBuildInputSnapshot, tenant: TenantId) {
  await replaceLayer(
    'profile_build_input_snapshot',
    [
      toItem(
        'profile_build_input_snapshot',
        snapshot,
        tenant,
        `${tenant.familyId}:${tenant.childId}:latest`
      ),
    ],
    tenant
  )
}

export async function getProfileBuildInputSnapshot(tenant: TenantId): Promise<ProfileBuildInputSnapshot | null> {
  return (await readLayer<ProfileBuildInputSnapshot>('profile_build_input_snapshot', tenant)).slice(-1)[0] || null
}

export async function purgeProfileBuildInputSnapshot(tenant: TenantId) {
  await replaceLayer('profile_build_input_snapshot', [], tenant)
}

export async function saveProfileBuildRun(run: ProfileBuildRun, tenant: TenantId) {
  await replaceLayer(
    'profile_build_run',
    [toItem('profile_build_run', run, tenant, `${tenant.familyId}:${tenant.childId}:latest`)],
    tenant
  )
}

export async function getLatestProfileBuildRun(tenant: TenantId): Promise<ProfileBuildRun | null> {
  return (await readLayer<ProfileBuildRun>('profile_build_run', tenant)).slice(-1)[0] || null
}

export async function saveProfileBuildStageCache(cache: ProfileBuildStageCache, tenant: TenantId) {
  await replaceLayer(
    'profile_build_stage_cache',
    [
      toItem(
        'profile_build_stage_cache',
        cache,
        tenant,
        `${tenant.familyId}:${tenant.childId}:latest`
      ),
    ],
    tenant
  )
}

export async function getProfileBuildStageCache(tenant: TenantId): Promise<ProfileBuildStageCache | null> {
  return (await readLayer<ProfileBuildStageCache>('profile_build_stage_cache', tenant)).slice(-1)[0] || null
}

export async function clearProfileBuildStageCache(tenant: TenantId) {
  await replaceLayer('profile_build_stage_cache', [], tenant)
}

export type AccountClientBackup = {
  version: 'account.client.v1'
  dailyThread: Array<{
    role: 'parent' | 'ai'
    text: string
    cards?: unknown
    linkedAreas?: string[]
  }>
  storage: Record<string, unknown> | null
  updatedAt: string
}

export async function saveAccountClientBackup(backup: AccountClientBackup, tenant: TenantId) {
  await replaceLayer(
    'account_client_backup',
    [toItem('account_client_backup', backup, tenant, `${tenant.familyId}:${tenant.childId}:latest`)],
    tenant
  )
}

export async function getAccountClientBackup(tenant: TenantId): Promise<AccountClientBackup | null> {
  return (await readLayer<AccountClientBackup>('account_client_backup', tenant)).slice(-1)[0] || null
}

/** 孩子基础档：建档后采集，供后续任务、预演与成长轨迹个性化读取。
 * 首版 synthesis/diagnosis 保持既有输入，本字段不注入首版诊断。 */
export type ChildBasicInfo = {
  nickname?: string
  grade?: string
  age?: string
  province?: string
  caregiverRelation?: string
  companionTime?: string
  helpGoal?: string
  updatedAt: string
}

export async function saveChildBasicInfo(info: ChildBasicInfo, tenant: TenantId) {
  await replaceLayer(
    'child_basic',
    [toItem('child_basic', info, tenant, `${tenant.familyId}:${tenant.childId}:latest`)],
    tenant
  )
}

export async function getChildBasicInfo(tenant: TenantId): Promise<ChildBasicInfo | null> {
  return (await readLayer<ChildBasicInfo>('child_basic', tenant)).slice(-1)[0] || null
}

export async function saveConditionalProfile(profile: ConditionalProfile, tenant: TenantId) {
  await upsertLayer('conditional_profiles', [toItem('conditional_profiles', profile, tenant)], tenant)
}

export async function getConditionalProfiles(tenant: TenantId): Promise<ConditionalProfile[]> {
  return readLayer<ConditionalProfile>('conditional_profiles', tenant)
}

/* ================================================================
   L6: PendingHypothesis
   ================================================================ */
export async function savePendingHypotheses(hypotheses: PendingHypothesis[], tenant: TenantId) {
  await upsertLayer('pending_hypotheses', hypotheses.map(hypothesis => toItem('pending_hypotheses', hypothesis, tenant)), tenant)
}

export async function getPendingHypotheses(tenant: TenantId): Promise<PendingHypothesis[]> {
  return readLayer<PendingHypothesis>('pending_hypotheses', tenant)
}

export async function updateHypothesisWeight(hypothesisId: string, newWeight: PendingHypothesis['weight'], tenant: TenantId) {
  const hyps = await readLayer<PendingHypothesis>('pending_hypotheses', tenant)
  const target = hyps.find(h => h.hypothesisId === hypothesisId)
  if (target) {
    target.weight = newWeight
    target.updatedAt = new Date().toISOString()
    await upsertLayer('pending_hypotheses', [toItem('pending_hypotheses', target, tenant)], tenant)
  }
}

/* ================================================================
   L7: FamilyInteractionCycle
   ================================================================ */
export async function saveFamilyInteractionCycles(cycles: FamilyInteractionCycle[], tenant: TenantId) {
  await upsertLayer('interaction_cycles', cycles.map(cycle => toItem('interaction_cycles', cycle, tenant)), tenant)
}

export async function getFamilyInteractionCycles(tenant: TenantId): Promise<FamilyInteractionCycle[]> {
  return readLayer<FamilyInteractionCycle>('interaction_cycles', tenant)
}

/* ================================================================
   L8: ParentNarrativePattern
   ================================================================ */
export async function saveParentNarrativePattern(pattern: ParentNarrativePattern, tenant: TenantId) {
  await replaceLayer('parent_narrative_patterns', [toItem('parent_narrative_patterns', pattern, tenant, `${tenant.familyId}:${tenant.childId}:latest`)], tenant)
}

export async function getParentNarrativePattern(tenant: TenantId): Promise<ParentNarrativePattern | null> {
  return (await readLayer<ParentNarrativePattern>('parent_narrative_patterns', tenant)).slice(-1)[0] || null
}

/* ================================================================
   L9: DailyInteractionUpdate
   ================================================================ */
export async function saveDailyInteractionUpdate(update: DailyInteractionUpdate, tenant: TenantId) {
  await upsertLayer('daily_updates', [toItem('daily_updates', update, tenant)], tenant)
}

export async function getDailyInteractionUpdates(tenant: TenantId): Promise<DailyInteractionUpdate[]> {
  return readLayer<DailyInteractionUpdate>('daily_updates', tenant)
}

/* ================================================================
   TurnEvent：每轮前台对话的输入+输出快照（交付文档 7.2，字段闭环可复现）。
   layer_name='turn_events'、item_id=traceId（全局唯一，重试/重发幂等）；DB-off 降级进程内存同源。
   ================================================================ */
export async function saveTurnEvent(tenant: TenantId, event: TurnEvent): Promise<void> {
  await upsertLayer('turn_events', [toItem('turn_events', event, tenant, event.traceId)], tenant)
}

export async function getTurnEventByTraceId(tenant: TenantId, traceId: string): Promise<TurnEvent | null> {
  // DB 启用：按 item_id=traceId 主键直查（O(1)），避免加载整层 turn_events 再 JS 过滤（随交互增长退化）。
  if (typeof window === 'undefined' && isDatabaseEnabled()) {
    return (await loadMemoryLayerItemById<TurnEvent>('turn_events', traceId, tenant.familyId, tenant.childId)) || null
  }
  const all = readClientLayer<TurnEvent>('turn_events', tenant)
  return all.find(e => e.traceId === traceId) || null
}

export async function listTurnEvents(tenant: TenantId, limit = 50): Promise<TurnEvent[]> {
  const all = await readLayer<TurnEvent>('turn_events', tenant)
  return all
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-limit)
    .reverse()
}

/* ================================================================
   UserTask：家长待试任务（跨设备，关联 sourceTraceId）
   ================================================================ */
export async function getUserTasks(tenant: TenantId): Promise<UserTask[]> {
  return readLayer<UserTask>('user_tasks', tenant)
}

export async function saveUserTasks(tasks: UserTask[], tenant: TenantId) {
  await replaceLayer(
    'user_tasks',
    tasks.map((task) => toItem('user_tasks', task, tenant, task.taskId)),
    tenant
  )
}

export async function getUserTaskById(tenant: TenantId, taskId: string): Promise<UserTask | null> {
  if (typeof window === 'undefined' && isDatabaseEnabled()) {
    return (await loadMemoryLayerItemById<UserTask>('user_tasks', taskId, tenant.familyId, tenant.childId)) || null
  }
  const all = await getUserTasks(tenant)
  return all.find((t) => t.taskId === taskId) || null
}

/* ================================================================
   GrowthTrajectory：面向家长的成长手账快照。
   原始事件仍分别存于 turn/task/rehearsal 等层；这里只保存可展示的筛选与汇总结果。
   ================================================================ */
export type GrowthTrajectoryEntry = {
  entryId: string
  occurredAt: string
  title: string
  summary: string
  sourceTypes: string[]
  sourceIds: string[]
  relatedTaskIds?: string[]
  relatedRehearsalIds?: string[]
}

export type GrowthTrajectorySnapshot = {
  sourceHash: string
  summary: string
  entries: GrowthTrajectoryEntry[]
  updatedAt: string
}

export async function getGrowthTrajectorySnapshot(tenant: TenantId): Promise<GrowthTrajectorySnapshot | null> {
  return (await readLayer<GrowthTrajectorySnapshot>('growth_trajectory', tenant)).slice(-1)[0] || null
}

export async function saveGrowthTrajectorySnapshot(snapshot: GrowthTrajectorySnapshot, tenant: TenantId) {
  await replaceLayer(
    'growth_trajectory',
    [toItem('growth_trajectory', snapshot, tenant, `${tenant.familyId}:${tenant.childId}:latest`)],
    tenant
  )
}

export type ParentInputRecord = {
  text: string
  timestamp: string
  source: 'daily_update' | 'turn_event'
  traceId?: string
}

/** 合并 daily_updates + turn_events，保证历史家长输入可被检索召回 */
export async function getMergedParentInputHistory(
  tenant: TenantId,
  limit = 80
): Promise<ParentInputRecord[]> {
  const [updates, turns] = await Promise.all([
    getDailyInteractionUpdates(tenant),
    readLayer<TurnEvent>('turn_events', tenant),
  ])

  const byText = new Map<string, ParentInputRecord>()

  for (const u of updates) {
    const text = u.newInput?.trim()
    if (!text) continue
    const timestamp = u.timestamp || u.createdAt || ''
    byText.set(text, {
      text,
      timestamp,
      source: 'daily_update',
      traceId: u.sourceEventId,
    })
  }

  for (const t of turns) {
    const text = t.userMessage?.trim()
    if (!text) continue
    const timestamp = t.createdAt || ''
    const prev = byText.get(text)
    if (!prev || timestamp >= prev.timestamp) {
      byText.set(text, {
        text,
        timestamp,
        source: 'turn_event',
        traceId: t.traceId,
      })
    }
  }

  return [...byText.values()]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-limit)
}

/* ================================================================
   L10: RetrievalIndex
   ================================================================ */
export async function saveRetrievalIndexes(indexes: RetrievalIndex[], tenant: TenantId) {
  await upsertLayer('retrieval_indexes', indexes.map(index => toItem('retrieval_indexes', index, tenant)), tenant)
}

export async function getRetrievalIndexes(tenant: TenantId): Promise<RetrievalIndex[]> {
  return readLayer<RetrievalIndex>('retrieval_indexes', tenant)
}

export async function getRetrievalIndexesByTag(tag: string, tenant: TenantId): Promise<RetrievalIndex[]> {
  return (await readLayer<RetrievalIndex>('retrieval_indexes', tenant)).filter(
    i => i.sceneTags.includes(tag) || i.mechanismTags.includes(tag)
  )
}

/* ================================================================
   Debug / Reset
   ================================================================ */
export async function debugMemoryLayerCounts(tenant: TenantId): Promise<Record<string, number>> {
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
    rawMaterials: (await getRawMaterials(tenant)).length,
    cleanedFacts: (await getCleanedFacts(tenant)).length,
    entryEvidencePacks: (await getEntryEvidencePacks(tenant)).length,
    evidenceNetworks: (await readLayer('evidence_networks', tenant)).length,
    childStructureModels: (await readLayer('child_structure_models', tenant)).length,
    conditionalProfiles: (await getConditionalProfiles(tenant)).length,
    pendingHypotheses: (await getPendingHypotheses(tenant)).length,
    interactionCycles: (await getFamilyInteractionCycles(tenant)).length,
    parentNarrativePatterns: (await readLayer('parent_narrative_patterns', tenant)).length,
    dailyUpdates: (await getDailyInteractionUpdates(tenant)).length,
    retrievalIndexes: (await getRetrievalIndexes(tenant)).length
  }
}

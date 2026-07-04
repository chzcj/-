import { BUILD_ENTRY_ORDER, normalizeBuildEntryType, type BuildEntryType } from '@/lib/profile/buildEntries'
import type { BuildEntryStatus, EntryType, LocalBuildSession, LocalEntryRecord, LocalFollowUpRecord, LocalStageSummary, SourceType } from '@/types/storage'
import { DEFAULT_CHILD_ID, DEFAULT_FAMILY_ID } from './storageSeed'
import { updateStorage, getStorage } from './localStorageService'
import { createId } from './storageIds'

export function getOrCreateBuildSession() {
  const storage = getStorage()
  let session = storage.buildSessions.find(
    (s) => s.familyId === DEFAULT_FAMILY_ID && s.childId === DEFAULT_CHILD_ID && s.status !== 'completed'
  )
  if (!session) {
    const now = new Date().toISOString()
    session = {
      id: createId('build'),
      familyId: DEFAULT_FAMILY_ID,
      childId: DEFAULT_CHILD_ID,
      status: 'collecting',
      startedAt: now,
      completedEntries: [],
      createdAt: now,
      updatedAt: now,
    }
    updateStorage((current) => ({ ...current, buildSessions: [...current.buildSessions, session!] }))
  }
  return session
}

export function createEntryRecord(input: {
  entryType: EntryType
  rawText: string
  sourceType?: SourceType
}) {
  const now = new Date().toISOString()
  const record: LocalEntryRecord = {
    id: createId('entry'),
    familyId: DEFAULT_FAMILY_ID,
    childId: DEFAULT_CHILD_ID,
    buildSessionId: getOrCreateBuildSession().id,
    entryType: input.entryType,
    sourceType: input.sourceType || 'text',
    rawText: input.rawText,
    createdAt: now,
    updatedAt: now,
  }
  updateStorage((current) => ({ ...current, entryRecords: [...current.entryRecords, record] }))
  return record
}

export function createFollowUpRecord(input: {
  entryType: string
  purpose: string
  directions: string[]
  voicePrompt: string
  userAnswer?: string
}) {
  const now = new Date().toISOString()
  const record: LocalFollowUpRecord = {
    id: createId('followup'),
    familyId: DEFAULT_FAMILY_ID,
    childId: DEFAULT_CHILD_ID,
    buildSessionId: getOrCreateBuildSession().id,
    ...input,
    createdAt: now,
    updatedAt: now,
  }
  updateStorage((current) => ({ ...current, followUpRecords: [...current.followUpRecords, record] }))
  return record
}

export function createStageSummary(input: {
  entryType: string
  mainJudgment: string
  facts: string[]
  pendingHypotheses: string[]
  note?: string
}) {
  const now = new Date().toISOString()
  const record: LocalStageSummary = {
    id: createId('summary'),
    familyId: DEFAULT_FAMILY_ID,
    childId: DEFAULT_CHILD_ID,
    buildSessionId: getOrCreateBuildSession().id,
    ...input,
    createdAt: now,
    updatedAt: now,
  }
  updateStorage((current) => ({ ...current, stageSummaries: [...current.stageSummaries, record] }))
  return record
}

/** 同一入口只保留最新阶段总结（避免重试重复、保证 synthesis 读到最新） */
export function upsertStageSummary(input: {
  entryType: string
  mainJudgment: string
  facts: string[]
  pendingHypotheses: string[]
  note?: string
}) {
  const now = new Date().toISOString()
  const record: LocalStageSummary = {
    id: createId('summary'),
    familyId: DEFAULT_FAMILY_ID,
    childId: DEFAULT_CHILD_ID,
    buildSessionId: getOrCreateBuildSession().id,
    ...input,
    createdAt: now,
    updatedAt: now,
  }
  updateStorage((current) => ({
    ...current,
    stageSummaries: [
      ...current.stageSummaries.filter((s) => s.entryType !== input.entryType),
      record,
    ],
  }))
  return record
}

export function markBuildSessionCompleted() {
  updateStorage((current) => ({
    ...current,
    buildSessions: current.buildSessions.map((s) => {
      if (s.familyId === DEFAULT_FAMILY_ID && s.childId === DEFAULT_CHILD_ID) {
        return { ...s, status: 'completed' as const, updatedAt: new Date().toISOString() }
      }
      return s
    }),
  }))
}

export function markEntryCompleted(entryType: EntryType) {
  updateStorage((current) => {
    const sessions = current.buildSessions.map((s) => {
      if (s.familyId === DEFAULT_FAMILY_ID && s.childId === DEFAULT_CHILD_ID && s.status === 'collecting') {
        const completed = s.completedEntries.includes(entryType)
          ? s.completedEntries
          : [...s.completedEntries, entryType]
        return { ...s, completedEntries: completed, updatedAt: new Date().toISOString() }
      }
      return s
    })
    return { ...current, buildSessions: sessions }
  })
}

export function getAllEntryStatuses(): Record<BuildEntryType, BuildEntryStatus> {
  const result = {} as Record<BuildEntryType, BuildEntryStatus>
  for (const type of BUILD_ENTRY_ORDER) {
    result[type] = getEntryStatus(type)
  }
  return result
}

function legacyStatusesFor(type: BuildEntryType): string[] {
  switch (type) {
    case 'daily':
      return ['daily', 'routine']
    case 'homework':
      return ['homework', 'study']
    case 'communication':
      return ['communication', 'emotion']
    case 'family':
      return ['family', 'environment']
    default:
      return [type]
  }
}

function legacyTypesFor(type: BuildEntryType): string[] {
  return legacyStatusesFor(type)
}

export function getLatestEntryRecord(entryType: string) {
  const normalized = normalizeBuildEntryType(entryType)
  const types = normalized ? legacyTypesFor(normalized) : [entryType]
  const storage = getStorage()
  return storage.entryRecords
    .filter((r) => types.includes(r.entryType))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export function getFollowUpRecordsForEntry(entryType: string) {
  const normalized = normalizeBuildEntryType(entryType)
  const types = normalized ? legacyTypesFor(normalized) : [entryType]
  const storage = getStorage()
  return storage.followUpRecords
    .filter((r) => types.includes(r.entryType))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** 入口首轮 + 各轮追问补充，供 AI 阶段总结 / 继续追问使用 */
export function getCombinedEntryText(entryType: string): string {
  const entry = getLatestEntryRecord(entryType)
  if (!entry?.rawText?.trim()) return ''
  const parts = [entry.rawText.trim()]
  for (const followUp of getFollowUpRecordsForEntry(entryType)) {
    const answer = followUp.userAnswer?.trim()
    if (answer) parts.push(answer)
  }
  return parts.join('\n\n')
}

export function getLatestStageSummary(entryType: string) {
  const normalized = normalizeBuildEntryType(entryType)
  const types = normalized ? legacyTypesFor(normalized) : [entryType]
  const storage = getStorage()
  return storage.stageSummaries
    .filter((s) => types.includes(s.entryType))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

function isBuildEntry(value: string): value is BuildEntryType {
  return (BUILD_ENTRY_ORDER as readonly string[]).includes(value)
}

export function getEntryStatus(entryType: EntryType): BuildEntryStatus {
  const normalized = normalizeBuildEntryType(entryType) ?? (isBuildEntry(entryType) ? entryType : null)
  if (!normalized) return 'not_started'
  const storage = getStorage()
  const session = storage.buildSessions.find(
    (s) => s.familyId === DEFAULT_FAMILY_ID && s.childId === DEFAULT_CHILD_ID && s.status !== 'completed'
  )
  const aliases = legacyStatusesFor(normalized)
  if (session?.completedEntries.some((e) => aliases.includes(e))) return 'completed'
  const hasEntries = storage.entryRecords.some((e) => aliases.includes(e.entryType))
  return hasEntries ? 'in_progress' : 'not_started'
}

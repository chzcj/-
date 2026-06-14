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

export function getEntryStatus(entryType: EntryType): BuildEntryStatus {
  const storage = getStorage()
  const session = storage.buildSessions.find(
    (s) => s.familyId === DEFAULT_FAMILY_ID && s.childId === DEFAULT_CHILD_ID && s.status !== 'completed'
  )
  if (!session) return 'not_started'
  if (session.completedEntries.includes(entryType)) return 'completed'
  const hasEntries = storage.entryRecords.some((e) => e.entryType === entryType)
  return hasEntries ? 'in_progress' : 'not_started'
}

export function getAllEntryStatuses(): Record<EntryType, BuildEntryStatus> {
  const types: EntryType[] = ['study', 'routine', 'communication', 'emotion', 'environment']
  const result = {} as Record<EntryType, BuildEntryStatus>
  for (const type of types) {
    result[type] = getEntryStatus(type)
  }
  return result
}

export function getLatestEntryRecord(entryType: string) {
  const storage = getStorage()
  return storage.entryRecords
    .filter((r) => r.entryType === entryType)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export function getLatestStageSummary(entryType: string) {
  const storage = getStorage()
  return storage.stageSummaries
    .filter((s) => s.entryType === entryType)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

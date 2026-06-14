import type { LocalDailyObservation } from '@/types/storage'
import { DEFAULT_CHILD_ID, DEFAULT_FAMILY_ID } from './storageSeed'
import { updateStorage, getStorage } from './localStorageService'
import { createId } from './storageIds'

export function createDailyObservation(input: { rawText: string; insight?: string; linkedAreas?: string[]; note?: string }) {
  const now = new Date().toISOString()
  const record: LocalDailyObservation = {
    id: createId('obs'),
    familyId: DEFAULT_FAMILY_ID,
    childId: DEFAULT_CHILD_ID,
    rawText: input.rawText,
    insight: input.insight,
    linkedAreas: input.linkedAreas || [],
    note: input.note,
    observedAt: now,
    createdAt: now,
    updatedAt: now,
  }
  updateStorage((current) => ({ ...current, dailyObservations: [...current.dailyObservations, record] }))
  return record
}

export function listDailyObservations(days = 7) {
  const storage = getStorage()
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return storage.dailyObservations
    .filter((o) => o.childId === DEFAULT_CHILD_ID && new Date(o.observedAt).getTime() > cutoff)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getObservationCount() {
  const storage = getStorage()
  return storage.dailyObservations.filter((o) => o.childId === DEFAULT_CHILD_ID).length
}

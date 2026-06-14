import type { ChildOSLocalStorageV1 } from '@/types/storage'

export const DEFAULT_FAMILY_ID = process.env.NEXT_PUBLIC_FAMILY_ID || 'family_demo'
export const DEFAULT_CHILD_ID = process.env.NEXT_PUBLIC_CHILD_ID || 'child_demo'

export function createInitialStorage(): ChildOSLocalStorageV1 {
  const now = new Date().toISOString()
  return {
    version: 'childos.storage.v1',
    activeFamilyId: DEFAULT_FAMILY_ID,
    activeChildId: DEFAULT_CHILD_ID,
    families: [
      { id: DEFAULT_FAMILY_ID, displayName: '我的家庭', createdAt: now, updatedAt: now },
    ],
    children: [
      { id: DEFAULT_CHILD_ID, familyId: DEFAULT_FAMILY_ID, nickname: '孩子', grade: '', createdAt: now, updatedAt: now },
    ],
    buildSessions: [],
    entryRecords: [],
    followUpRecords: [],
    stageSummaries: [],
    profileSnapshots: [],
    evidenceRecords: [],
    verificationPoints: [],
    dailyObservations: [],
    updatedAt: now,
  }
}

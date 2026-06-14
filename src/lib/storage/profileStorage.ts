import type { LocalEvidenceRecord, LocalProfileSnapshot, LocalVerificationPoint } from '@/types/storage'
import { DEFAULT_CHILD_ID, DEFAULT_FAMILY_ID } from './storageSeed'
import { updateStorage, getStorage } from './localStorageService'
import { createId } from './storageIds'

export function createProfileSnapshot(input: {
  completeness: number
  coreJudgment: string
  deepMechanism: string
  supportFocus?: string
  evidence?: Omit<LocalEvidenceRecord, 'id' | 'familyId' | 'childId' | 'profileSnapshotId' | 'createdAt' | 'updatedAt'>[]
  verificationPoints?: Omit<LocalVerificationPoint, 'id' | 'familyId' | 'childId' | 'profileSnapshotId' | 'status' | 'createdAt' | 'updatedAt'>[]
}) {
  const now = new Date().toISOString()
  const profileId = createId('profile')
  const profile: LocalProfileSnapshot = {
    id: profileId,
    familyId: DEFAULT_FAMILY_ID,
    childId: DEFAULT_CHILD_ID,
    completeness: input.completeness,
    coreJudgment: input.coreJudgment,
    deepMechanism: input.deepMechanism,
    supportFocus: input.supportFocus,
    createdAt: now,
    updatedAt: now,
  }
  const evidenceRecords: LocalEvidenceRecord[] = (input.evidence || []).map((e) => ({
    id: createId('evidence'),
    familyId: DEFAULT_FAMILY_ID,
    childId: DEFAULT_CHILD_ID,
    profileSnapshotId: profileId,
    ...e,
    createdAt: now,
    updatedAt: now,
  }))
  const vpRecords: LocalVerificationPoint[] = (input.verificationPoints || []).map((v) => ({
    id: createId('verify'),
    familyId: DEFAULT_FAMILY_ID,
    childId: DEFAULT_CHILD_ID,
    profileSnapshotId: profileId,
    ...v,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
  }))
  updateStorage((current) => ({
    ...current,
    profileSnapshots: [...current.profileSnapshots, profile],
    evidenceRecords: [...current.evidenceRecords, ...evidenceRecords],
    verificationPoints: [...current.verificationPoints, ...vpRecords],
  }))
  return { profile, evidence: evidenceRecords, verificationPoints: vpRecords }
}

export function getLatestProfile() {
  const storage = getStorage()
  const profile = storage.profileSnapshots
    .filter((p) => p.childId === DEFAULT_CHILD_ID)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!profile) return null
  return {
    ...profile,
    evidence: storage.evidenceRecords.filter((e) => e.profileSnapshotId === profile.id),
    verificationPoints: storage.verificationPoints.filter((v) => v.profileSnapshotId === profile.id),
  }
}

export function hasProfile() {
  return getLatestProfile() !== null
}

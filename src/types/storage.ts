export type EntryType =
  | 'study'
  | 'routine'
  | 'communication'
  | 'emotion'
  | 'environment'
  | 'child_voice'
  | 'teacher_observation'
  | 'final_follow_up'

export type SourceType = 'text' | 'voice' | 'upload' | 'mock'

export type BuildEntryStatus = 'not_started' | 'in_progress' | 'completed'

export type LocalFamily = {
  id: string
  displayName: string
  createdAt: string
  updatedAt: string
}

export type LocalChild = {
  id: string
  familyId: string
  nickname?: string
  grade?: string
  age?: number
  createdAt: string
  updatedAt: string
}

export type LocalBuildSession = {
  id: string
  familyId: string
  childId: string
  status: 'not_started' | 'collecting' | 'completed'
  startedAt: string
  completedAt?: string
  completedEntries: EntryType[]
  createdAt: string
  updatedAt: string
}

export type LocalEntryRecord = {
  id: string
  familyId: string
  childId: string
  buildSessionId?: string
  entryType: EntryType
  sourceType: SourceType
  rawText: string
  createdAt: string
  updatedAt: string
}

export type LocalFollowUpRecord = {
  id: string
  familyId: string
  childId: string
  buildSessionId?: string
  entryType: string
  purpose: string
  directions: string[]
  voicePrompt: string
  userAnswer?: string
  createdAt: string
  updatedAt: string
}

export type LocalStageSummary = {
  id: string
  familyId: string
  childId: string
  buildSessionId?: string
  entryType: string
  mainJudgment: string
  facts: string[]
  pendingHypotheses: string[]
  note?: string
  createdAt: string
  updatedAt: string
}

export type LocalProfileSnapshot = {
  id: string
  familyId: string
  childId: string
  buildSessionId?: string
  completeness: number
  coreJudgment: string
  deepMechanism: string
  supportFocus?: string
  summaryJson?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type LocalEvidenceRecord = {
  id: string
  familyId: string
  childId: string
  profileSnapshotId: string
  sourceLabel: string
  evidenceText: string
  explanation: string
  strength: 'weak' | 'medium' | 'strong'
  createdAt: string
  updatedAt: string
}

export type LocalVerificationPoint = {
  id: string
  familyId: string
  childId: string
  profileSnapshotId: string
  title: string
  description: string
  status: 'active' | 'resolved' | 'dismissed'
  createdAt: string
  updatedAt: string
}

export type LocalDailyObservation = {
  id: string
  familyId: string
  childId: string
  rawText: string
  insight?: string
  linkedAreas: string[]
  note?: string
  observedAt: string
  createdAt: string
  updatedAt: string
}

export type ChildOSLocalStorageV1 = {
  version: 'childos.storage.v1'
  activeFamilyId: string
  activeChildId: string
  families: LocalFamily[]
  children: LocalChild[]
  buildSessions: LocalBuildSession[]
  entryRecords: LocalEntryRecord[]
  followUpRecords: LocalFollowUpRecord[]
  stageSummaries: LocalStageSummary[]
  profileSnapshots: LocalProfileSnapshot[]
  evidenceRecords: LocalEvidenceRecord[]
  verificationPoints: LocalVerificationPoint[]
  dailyObservations: LocalDailyObservation[]
  updatedAt: string
}

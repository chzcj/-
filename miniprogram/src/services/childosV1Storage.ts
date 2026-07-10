import type { BuildEntryType, BuildState } from '@/services/buildState'
import { BUILD_MODULES, loadBuildState, saveBuildState } from '@/services/buildState'
import { loadChildBasicInfo, saveChildBasicInfoLocal } from '@/services/childStorage'
import { getLatestProfile, hydrateProfileFromRemote } from '@/services/profileStorage'

const FAMILY_ID = 'family_default'
const CHILD_ID = 'child_default'

export type ChildOSLocalStorageV1 = {
  version: 'childos.storage.v1'
  activeFamilyId: string
  activeChildId: string
  families: Array<{ id: string; displayName: string; createdAt: string; updatedAt: string }>
  children: Array<{
    id: string
    familyId: string
    nickname?: string
    grade?: string
    createdAt: string
    updatedAt: string
  }>
  buildSessions: Array<{
    id: string
    familyId: string
    childId: string
    status: 'not_started' | 'collecting' | 'completed'
    startedAt: string
    completedAt?: string
    completedEntries: string[]
    createdAt: string
    updatedAt: string
  }>
  entryRecords: Array<{
    id: string
    familyId: string
    childId: string
    buildSessionId?: string
    entryType: string
    sourceType: string
    rawText: string
    createdAt: string
    updatedAt: string
  }>
  followUpRecords: Array<{
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
  }>
  stageSummaries: Array<{
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
  }>
  profileSnapshots: Array<{
    id: string
    familyId: string
    childId: string
    completeness: number
    coreJudgment: string
    deepMechanism: string
    supportFocus?: string
    createdAt: string
    updatedAt: string
  }>
  evidenceRecords: unknown[]
  verificationPoints: unknown[]
  dailyObservations: unknown[]
  updatedAt: string
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isV1Storage(value: unknown): value is ChildOSLocalStorageV1 {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as ChildOSLocalStorageV1).version === 'childos.storage.v1'
  )
}

/** 从分散的 MP 本地键组装完整 childos.v1（对齐 Web accountSync） */
export function assembleChildOSV1(): ChildOSLocalStorageV1 {
  const now = new Date().toISOString()
  const basic = loadChildBasicInfo()
  const buildState = loadBuildState()
  const profile = getLatestProfile()
  const sessionId = createId('build')

  const completedEntries = BUILD_MODULES.filter((mod) => {
    const m = buildState.entryMap[mod.key]
    return Boolean(m?.moduleComplete)
  }).map((mod) => mod.key)

  const entryRecords: ChildOSLocalStorageV1['entryRecords'] = []
  const followUpRecords: ChildOSLocalStorageV1['followUpRecords'] = []
  const stageSummaries: ChildOSLocalStorageV1['stageSummaries'] = []

  for (const mod of BUILD_MODULES) {
    const m = buildState.entryMap[mod.key]
    if (!m) continue
    const raw = m.rawTexts.join('\n\n').trim()
    if (raw) {
      entryRecords.push({
        id: createId('entry'),
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        buildSessionId: sessionId,
        entryType: mod.key,
        sourceType: 'text',
        rawText: raw,
        createdAt: now,
        updatedAt: now,
      })
    }
    m.followUps.forEach((answer, i) => {
      if (!answer.trim()) return
      followUpRecords.push({
        id: createId('followup'),
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        buildSessionId: sessionId,
        entryType: mod.key,
        purpose: `追问 ${i + 1}`,
        directions: [],
        voicePrompt: '',
        userAnswer: answer.trim(),
        createdAt: now,
        updatedAt: now,
      })
    })
    if (m.stageSummary) {
      stageSummaries.push({
        id: createId('summary'),
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        buildSessionId: sessionId,
        entryType: mod.key,
        mainJudgment: m.stageSummary,
        facts: m.aiFacts || [],
        pendingHypotheses: m.aiHypotheses || [],
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  const profileSnapshots: ChildOSLocalStorageV1['profileSnapshots'] = []
  if (profile?.coreJudgment) {
    profileSnapshots.push({
      id: createId('profile'),
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      completeness: profile.completeness || 0,
      coreJudgment: profile.coreJudgment,
      deepMechanism: profile.deepMechanism || '',
      supportFocus: profile.supportFocus,
      createdAt: now,
      updatedAt: now,
    })
  }

  return {
    version: 'childos.storage.v1',
    activeFamilyId: FAMILY_ID,
    activeChildId: CHILD_ID,
    families: [{ id: FAMILY_ID, displayName: '我的家庭', createdAt: now, updatedAt: now }],
    children: [
      {
        id: CHILD_ID,
        familyId: FAMILY_ID,
        nickname: basic.childName.trim() || '孩子',
        grade: basic.grade.trim(),
        createdAt: now,
        updatedAt: now,
      },
    ],
    buildSessions: [
      {
        id: sessionId,
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        status: completedEntries.length >= BUILD_MODULES.length ? 'completed' : 'collecting',
        startedAt: now,
        completedEntries,
        createdAt: now,
        updatedAt: now,
      },
    ],
    entryRecords,
    followUpRecords,
    stageSummaries,
    profileSnapshots,
    evidenceRecords: [],
    verificationPoints: [],
    dailyObservations: [],
    updatedAt: now,
  }
}

/** 从 childos.v1 回灌 MP 分散存储 */
export function hydrateFromChildOSV1(raw: unknown): boolean {
  if (!isV1Storage(raw)) return false

  const child = raw.children.find((c) => c.id === raw.activeChildId) || raw.children[0]
  if (child) {
    saveChildBasicInfoLocal({
      childName: String(child.nickname || ''),
      grade: String(child.grade || ''),
    })
  }

  const session =
    raw.buildSessions.find((s) => s.childId === raw.activeChildId && s.status !== 'completed') ||
    raw.buildSessions[raw.buildSessions.length - 1]

  const completedSet = new Set(session?.completedEntries || [])
  const state: BuildState = { entryMap: {} }

  const entryTypes: BuildEntryType[] = ['daily', 'homework', 'communication', 'family']
  for (const entryType of entryTypes) {
    const records = raw.entryRecords.filter((r) => r.entryType === entryType)
    const latestEntry = records[records.length - 1]
    const followUps = raw.followUpRecords
      .filter((r) => r.entryType === entryType && r.userAnswer?.trim())
      .map((r) => r.userAnswer!.trim())
    const summaries = raw.stageSummaries.filter((s) => s.entryType === entryType)
    const latestSummary = summaries[summaries.length - 1]

    if (!latestEntry && !followUps.length && !latestSummary) continue

    state.entryMap[entryType] = {
      rawTexts: latestEntry?.rawText ? [latestEntry.rawText] : [],
      followUps,
      stageSummary: latestSummary?.mainJudgment || '',
      aiFacts: latestSummary?.facts || [],
      aiHypotheses: latestSummary?.pendingHypotheses || [],
      moduleComplete: completedSet.has(entryType),
    }
  }

  if (buildStateHasData(state)) {
    saveBuildState(state)
  }

  const latestProfile = raw.profileSnapshots[raw.profileSnapshots.length - 1]
  if (latestProfile?.coreJudgment) {
    hydrateProfileFromRemote({
      coreJudgment: latestProfile.coreJudgment,
      completeness: latestProfile.completeness,
      deepMechanism: latestProfile.deepMechanism,
      supportFocus: latestProfile.supportFocus,
    })
  }

  return true
}

function buildStateHasData(state: BuildState): boolean {
  return Object.values(state.entryMap).some(
    (m) =>
      m &&
      (m.rawTexts.length > 0 ||
        m.followUps.length > 0 ||
        Boolean(m.stageSummary) ||
        m.moduleComplete)
  )
}

export { isV1Storage }

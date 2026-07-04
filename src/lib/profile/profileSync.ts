import { BUILD_ENTRY_ORDER } from '@/lib/profile/buildEntries'
import {
  hasSeenBuildIntro,
  isBasicInfoComplete,
  markBuildIntroSeen,
  markBasicInfoComplete,
} from '@/lib/storage/childStorage'
import {
  getAllEntryStatuses,
  markEntryCompleted,
  upsertStageSummary,
} from '@/lib/storage/entryStorage'
import { getStorage } from '@/lib/storage/localStorageService'
import { getLatestProfile } from '@/lib/storage/profileStorage'

/** 登录清本地前，把本机画像与四模块进度上传到服务器 */
export async function syncLocalProfileToServerIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return

  const profile = getLatestProfile()
  if (profile?.coreJudgment) {
    try {
      await fetch('/api/profile/built', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot: {
            completeness: profile.completeness,
            coreJudgment: profile.coreJudgment,
            deepMechanism: profile.deepMechanism,
            supportFocus: profile.supportFocus,
            evidence: (profile.evidence || []).map((e) => ({
              sourceLabel: e.sourceLabel,
              evidenceText: e.evidenceText,
              explanation: e.explanation,
              strength: e.strength,
            })),
            verificationPoints: (profile.verificationPoints || []).map((v) => ({
              title: v.title,
              description: v.description,
            })),
          },
        }),
      })
    } catch {
      /* 上传失败不阻断登录 */
    }
  }

  const statuses = getAllEntryStatuses()
  const completedEntries = BUILD_ENTRY_ORDER.filter((t) => statuses[t] === 'completed')
  const hasBuildData =
    completedEntries.length > 0 || hasSeenBuildIntro() || isBasicInfoComplete()
  if (!hasBuildData) return

  const storage = getStorage()
  try {
    await fetch('/api/profile/build-state', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        introSeen: hasSeenBuildIntro(),
        basicInfoDone: isBasicInfoComplete(),
        completedEntries,
        stageSummaries: (storage.stageSummaries || []).map((s) => ({
          entryType: s.entryType,
          mainJudgment: s.mainJudgment,
          facts: s.facts,
          pendingHypotheses: s.pendingHypotheses,
          note: s.note,
        })),
      }),
    })
  } catch {
    /* ignore */
  }
}

type RemoteBuildState = {
  introSeen?: boolean
  basicInfoDone?: boolean
  completedEntries?: string[]
  stageSummaries?: Array<{
    entryType: string
    mainJudgment: string
    facts: string[]
    pendingHypotheses: string[]
    note?: string
  }>
}

export function restoreBuildStateFromRemote(state: RemoteBuildState | null | undefined) {
  if (!state) return
  if (state.introSeen) markBuildIntroSeen()
  if (state.basicInfoDone) markBasicInfoComplete()
  for (const summary of state.stageSummaries || []) {
    if (!summary.entryType || !summary.mainJudgment) continue
    upsertStageSummary({
      entryType: summary.entryType,
      mainJudgment: summary.mainJudgment,
      facts: summary.facts || [],
      pendingHypotheses: summary.pendingHypotheses || [],
      note: summary.note,
    })
  }
  for (const entryType of state.completedEntries || []) {
    if (BUILD_ENTRY_ORDER.includes(entryType as (typeof BUILD_ENTRY_ORDER)[number])) {
      markEntryCompleted(entryType as (typeof BUILD_ENTRY_ORDER)[number])
    }
  }
}

/** 四模块进度有变更时，后台同步到服务器 */
export function pushBuildStateToServer(): void {
  if (typeof window === 'undefined') return
  void import('@/lib/account/accountSync').then((m) => m.pushAccountSyncToServer())
}

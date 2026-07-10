import { apiRequest } from '@/services/api'
import { isBasicInfoComplete } from '@/services/childStorage'
import { BUILD_MODULES, loadBuildState, syncBuildProgressToServer } from '@/services/buildState'
import { getLatestProfile, type LocalProfileSnapshot } from '@/services/profileStorage'

/** 登录/登出前：上传本机画像与四模块进度（对齐 Web profileSync.ts） */
export async function syncLocalProfileToServerIfNeeded(): Promise<void> {
  const profile = getLatestProfile()
  if (profile?.coreJudgment) {
    await apiRequest('/api/profile/built', {
      method: 'POST',
      data: { snapshot: profileToPayload(profile) },
    }).catch(() => undefined)
  }

  const state = loadBuildState()
  const hasBuildData =
    BUILD_MODULES.some((mod) => state.entryMap[mod.key]?.moduleComplete) || isBasicInfoComplete()

  if (hasBuildData) {
    await syncBuildProgressToServer().catch(() => undefined)
  }
}

function profileToPayload(profile: LocalProfileSnapshot) {
  return {
    completeness: profile.completeness,
    coreJudgment: profile.coreJudgment,
    deepMechanism: profile.deepMechanism || '',
    supportFocus: profile.supportFocus,
    evidence: [],
    verificationPoints: [],
  }
}

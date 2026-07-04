import { apiClient } from '@/lib/api-client'
import {
  forceAccountSyncToServer,
  restoreAccountStateFromServer,
} from '@/lib/account/accountSync'
import { buildOnboardingHref } from '@/lib/profile/buildGate'
import { hydrateProfileFromRemoteIfNeeded } from '@/lib/profile/profileHydrate'
import { isOnboardingComplete } from '@/lib/profile/onboarding'
import { clearAllChildOSData } from '@/lib/storage/localStorageService'

/** 登录/注册后：先上传本机 → 清本地 → 从服务器恢复 → 落到正确首页 */
export async function resolvePostAuthRoute(clearLocal: boolean): Promise<string> {
  if (clearLocal) {
    await forceAccountSyncToServer()
    clearAllChildOSData()
  }

  await restoreAccountStateFromServer()

  if (!isOnboardingComplete()) {
    await hydrateProfileFromRemoteIfNeeded()
  }

  return isOnboardingComplete() ? '/daily' : buildOnboardingHref()
}

export async function tryRestoreSession(): Promise<boolean> {
  try {
    const me = await apiClient.getMe()
    return me.ok && Boolean(me.data?.user)
  } catch {
    return false
  }
}

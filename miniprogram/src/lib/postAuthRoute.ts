import Taro from '@tarojs/taro'
import { forceAccountSyncToServer, restoreAccountStateFromServer } from '@/services/accountSync'
import { fetchCurrentUser } from '@/services/auth'
import { hydrateBuildStateFromServer } from '@/services/buildState'
import { clearAllChildOSData } from '@/services/localStorageService'
import { hydrateProfileFromRemoteIfNeeded } from '@/services/profileHydrate'
import { routeAfterAuth } from '@/utils/navigation'

/** 登录后：上传本机 → 清本地 → 从服务器恢复 → 落到正确首页（对齐 Web postAuthRoute.ts） */
export async function resolvePostAuthRoute(clearLocal: boolean): Promise<void> {
  if (clearLocal) {
    await forceAccountSyncToServer()
    clearAllChildOSData()
  }

  await restoreAccountStateFromServer()
  await hydrateBuildStateFromServer()

  const user = await fetchCurrentUser()
  if (!user) {
    void Taro.reLaunch({ url: '/pages/login/index' })
    return
  }

  if (!user.onboardingComplete) {
    await hydrateProfileFromRemoteIfNeeded()
  }

  const fresh = await fetchCurrentUser()
  routeAfterAuth(fresh || user, false)
}

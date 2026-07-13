import Taro from '@tarojs/taro'
import { forceAccountSyncToServer, restoreAccountStateFromServer } from '@/services/accountSync'
import { fetchCurrentUser } from '@/services/auth'
import { hydrateBuildStateFromServer } from '@/services/buildState'
import { clearAllChildOSData } from '@/services/localStorageService'
import { hydrateProfileFromRemoteIfNeeded } from '@/services/profileHydrate'
import { routeAfterAuth } from '@/utils/navigation'

export type ResolvePostAuthRouteOptions = {
  /** 上传本机后清空本地再恢复（换账号登录） */
  clearLocal?: boolean
  /** 上传本机但不清空（建档中途首次登录） */
  mergeLocal?: boolean
  /** 是否按用户状态自动跳转，默认 true */
  navigate?: boolean
}

/** 登录后：同步本机 ↔ 服务器 → 落到正确首页 */
export async function resolvePostAuthRoute(
  options: boolean | ResolvePostAuthRouteOptions = {}
): Promise<void> {
  const opts: ResolvePostAuthRouteOptions =
    typeof options === 'boolean' ? { clearLocal: options } : options

  if (opts.mergeLocal) {
    await forceAccountSyncToServer()
  } else if (opts.clearLocal) {
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

  if (opts.navigate === false) return

  const fresh = await fetchCurrentUser()
  routeAfterAuth(fresh || user, false)
}

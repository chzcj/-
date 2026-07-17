import { PropsWithChildren } from 'react'
import { useDidHide, useLaunch } from '@tarojs/taro'
import { pushAccountSyncToServer, restoreAccountStateFromServer } from '@/services/accountSync'
import { fetchCurrentUser } from '@/services/auth'
import { getSessionToken } from '@/services/api'
import { hydrateBuildStateFromServer } from '@/services/buildState'
import { hydrateProfileFromRemoteIfNeeded } from '@/services/profileHydrate'
import { fetchTasksFromServer } from '@/services/taskStorage'
import { routeAfterAuth } from '@/utils/navigation'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useDidHide(() => {
    if (getSessionToken()) pushAccountSyncToServer()
  })

  useLaunch(async () => {
    const token = getSessionToken()
    if (!token) return

    await restoreAccountStateFromServer()
    await hydrateBuildStateFromServer()

    const user = await fetchCurrentUser()
    if (!user) return

    if (!user.onboardingComplete) {
      await hydrateProfileFromRemoteIfNeeded()
    }

    void fetchTasksFromServer()

    const fresh = await fetchCurrentUser()
    routeAfterAuth(fresh || user, false)
  })

  // 入口组件在小程序端不渲染 UI，勿在此挂任何弹窗组件（会静默不可见）。
  // 隐私授权走微信官方弹窗：见 lib/wechatPrivacy.ts。
  return children
}

export default App

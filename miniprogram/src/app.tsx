import { PropsWithChildren } from 'react'
import { useDidHide, useLaunch } from '@tarojs/taro'
import { PrivacyAgreementGate } from '@/components/privacy/PrivacyAgreementGate'
import { pushAccountSyncToServer, restoreAccountStateFromServer } from '@/services/accountSync'
import { fetchCurrentUser } from '@/services/auth'
import { getSessionToken } from '@/services/api'
import { hydrateBuildStateFromServer } from '@/services/buildState'
import { hydrateProfileFromRemoteIfNeeded } from '@/services/profileHydrate'
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

    const fresh = await fetchCurrentUser()
    routeAfterAuth(fresh || user, false)
  })

  return (
    <>
      {children}
      <PrivacyAgreementGate />
    </>
  )
}

export default App

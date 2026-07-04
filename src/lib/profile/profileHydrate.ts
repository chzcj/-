import { isOnboardingComplete, markOnboardingComplete } from '@/lib/profile/onboarding'
import { restoreAccountStateFromServer } from '@/lib/account/accountSync'
import { restoreBuildStateFromRemote } from '@/lib/profile/profileSync'
import { syncBuildFlagsFromProfile } from '@/lib/storage/childStorage'
import { hydrateProfileFromRemote } from '@/lib/storage/profileStorage'

function ensureLocalOnboardingFromServerFlag() {
  syncBuildFlagsFromProfile()
  markOnboardingComplete()
}

/** 本机未完成 onboarding 时，从 DB 回灌画像与四模块进度 */
export async function hydrateProfileFromRemoteIfNeeded(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (isOnboardingComplete()) return true

  try {
    await restoreAccountStateFromServer()
    if (isOnboardingComplete()) return true

    const [builtRes, buildRes, meRes] = await Promise.all([
      fetch('/api/profile/built', { credentials: 'include' }),
      fetch('/api/profile/build-state', { credentials: 'include' }),
      fetch('/api/auth/me', { credentials: 'include' }),
    ])

    if (buildRes.ok) {
      const buildJson = (await buildRes.json()) as {
        ok?: boolean
        data?: { state?: Parameters<typeof restoreBuildStateFromRemote>[0] }
      }
      if (buildJson.ok && buildJson.data?.state) {
        restoreBuildStateFromRemote(buildJson.data.state)
      }
    }

    if (builtRes.ok) {
      const json = (await builtRes.json()) as {
        ok?: boolean
        data?: {
          snapshot?: Parameters<typeof hydrateProfileFromRemote>[0] | null
          onboardingComplete?: boolean
        }
      }
      const snapshot = json.data?.snapshot
      if (json.ok && snapshot?.coreJudgment) {
        hydrateProfileFromRemote(snapshot)
        syncBuildFlagsFromProfile()
      } else if (json.ok && json.data?.onboardingComplete) {
        ensureLocalOnboardingFromServerFlag()
      }
    }

    if (!isOnboardingComplete() && meRes.ok) {
      const meJson = (await meRes.json()) as {
        ok?: boolean
        data?: { user?: { onboardingComplete?: boolean } | null }
      }
      if (meJson.ok && meJson.data?.user?.onboardingComplete) {
        ensureLocalOnboardingFromServerFlag()
      }
    }
  } catch {
    return false
  }

  return isOnboardingComplete()
}

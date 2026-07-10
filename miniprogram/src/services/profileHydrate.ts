import { apiRequest } from '@/services/api'
import { fetchCurrentUser } from '@/services/auth'
import { hydrateBuildStateFromServer } from '@/services/buildState'
import { hydrateProfileFromRemote, hasProfile, type LocalProfileSnapshot } from '@/services/profileStorage'

/** 本机未完成 onboarding 时，从服务端回灌画像与建模进度 */
export async function hydrateProfileFromRemoteIfNeeded(): Promise<boolean> {
  const user = await fetchCurrentUser()
  if (user?.onboardingComplete || hasProfile()) return true

  const [built] = await Promise.all([
    apiRequest<{ snapshot?: LocalProfileSnapshot | null; onboardingComplete?: boolean }>(
      '/api/profile/built',
      { method: 'GET' }
    ),
    hydrateBuildStateFromServer(),
  ])

  if (built.ok && built.data.snapshot?.coreJudgment) {
    hydrateProfileFromRemote(built.data.snapshot)
  }

  const fresh = await fetchCurrentUser()
  return Boolean(fresh?.onboardingComplete || hasProfile())
}

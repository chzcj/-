import { BUILD_ENTRY_ORDER, normalizeBuildEntryType } from '@/lib/profile/buildEntries'
import { entryConfigs } from '@/data/entryConfig'
import { getBuildOnboardingStep } from '@/lib/profile/buildGate'
import { isOnboardingComplete } from '@/lib/profile/onboarding'
import { getAllEntryStatuses } from '@/lib/storage/entryStorage'
import { getStorage } from '@/lib/storage/localStorageService'
import { hasProfile } from '@/lib/storage/profileStorage'

const ENTRY_PREFIX = /^\/profile\/build\/(daily|homework|communication|family|study|routine|emotion|environment)(\/|$)/

export function isBuildRouteAllowed(pathname: string, reviewIntro: boolean): boolean {
  if (!pathname?.startsWith('/profile/build')) return true

  if (isOnboardingComplete()) {
    if (pathname === '/profile/build/intro' && !reviewIntro) return false
    return true
  }

  const step = getBuildOnboardingStep()

  if (pathname === '/profile/build/intro') {
    if (reviewIntro) return true
    return step === 'intro'
  }

  if (pathname === '/profile/build/basic') {
    return step === 'basic'
  }

  if (pathname === '/profile/build/final-follow-up') {
    if (step !== 'hub') return false
    const statuses = getAllEntryStatuses()
    return entryConfigs.every((e) => statuses[e.type] === 'completed')
  }

  if (pathname === '/profile/build') {
    return step === 'hub' || step === 'collect'
  }

  if (ENTRY_PREFIX.test(pathname)) {
    if (step === 'collect' || step === 'hub') return true
    return false
  }

  return true
}

export function canAccessProfileGenerating(): boolean {
  if (hasProfile()) return true
  const storage = getStorage()
  return (storage.followUpRecords || []).some(
    (f) => f.entryType === 'final' && Boolean(f.userAnswer?.trim())
  )
}

export function isKnownBuildEntryPath(pathname: string): boolean {
  const m = pathname.match(/^\/profile\/build\/([^/]+)/)
  if (!m) return false
  return normalizeBuildEntryType(m[1]) !== null || m[1] === 'intro' || m[1] === 'basic'
}

export { BUILD_ENTRY_ORDER }

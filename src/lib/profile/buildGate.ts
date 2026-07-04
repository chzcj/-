import { BUILD_ENTRY_ORDER, buildEntryPath, firstBuildEntryPath } from '@/lib/profile/buildEntries'
import { isOnboardingComplete } from '@/lib/profile/onboarding'
import { getAllEntryStatuses, getEntryStatus } from '@/lib/storage/entryStorage'
import { hasSeenBuildIntro, isBasicInfoComplete } from '@/lib/storage/childStorage'

export type BuildOnboardingStep = 'intro' | 'basic' | 'collect' | 'hub'

/** 新用户：intro → basic → 四模块线性采集（含追问）→ hub 收尾 */
export function getBuildOnboardingStep(): BuildOnboardingStep | null {
  if (isOnboardingComplete()) return null
  if (!hasSeenBuildIntro()) return 'intro'
  if (!isBasicInfoComplete()) return 'basic'
  const allDone = BUILD_ENTRY_ORDER.every((t) => getEntryStatus(t) === 'completed')
  if (allDone) return 'hub'
  return 'collect'
}

export function buildOnboardingHref(): string {
  const step = getBuildOnboardingStep()
  if (step === 'intro') return '/profile/build/intro'
  if (step === 'basic') return '/profile/build/basic'
  if (step === 'collect') {
    for (const t of BUILD_ENTRY_ORDER) {
      if (getEntryStatus(t) !== 'completed') return buildEntryPath(t)
    }
    return firstBuildEntryPath()
  }
  return '/profile/build'
}

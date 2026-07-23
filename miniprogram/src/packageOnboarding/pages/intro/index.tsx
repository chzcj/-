import { OnboardingInfoShell } from '@/components/onboarding/OnboardingInfoShell'
import { OnboardingLetterBlock } from '@/components/onboarding/OnboardingLetterBlock'
import { OnboardingGuideBlock } from '@/components/onboarding/OnboardingGuideBlock'
import { OnboardingSectionBreak } from '@/components/onboarding/OnboardingSectionBreak'
import { ONBOARDING_INFO_CONTENT } from '@/data/onboardingInfoContent'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { getSessionToken } from '@/services/api'
import { markIntroSeen } from '@/services/onboardingFlags'
import { syncBuildProgressToServer } from '@/services/buildState'
import './index.scss'

export default function OnboardingIntro() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })

  const handleStart = async () => {
    markIntroSeen()
    if (getSessionToken()) {
      await syncBuildProgressToServer({ introSeen: true }).catch(() => {})
    }
    await mpGoReplace('/packageOnboarding/pages/hub/index')
  }

  const { letter, guide } = ONBOARDING_INFO_CONTENT

  return (
    <OnboardingInfoShell actionLabel='开始' onAction={() => void handleStart()}>
      <OnboardingLetterBlock {...letter} />
      <OnboardingSectionBreak />
      <OnboardingGuideBlock {...guide} />
    </OnboardingInfoShell>
  )
}

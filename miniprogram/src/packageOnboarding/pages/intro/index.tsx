import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { syncBuildProgressToServer } from '@/services/buildState'
import './index.scss'

export default function OnboardingIntro() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })
  const handleStart = async () => {
    await syncBuildProgressToServer({ introSeen: true })
    await mpGoReplace('/packageOnboarding/pages/basic/index')
  }

  return (
    <HiFiBuildShell
      topTitle='认识你们家'
      stepLabel='开始'
      progress={8}
      actions={[{ label: '开始', onClick: () => void handleStart() }]}
    >
      <HiFiBuildHero
        kicker='欢迎使用育见'
        title='先认识你们家'
        mascot={false}
      />
    </HiFiBuildShell>
  )
}

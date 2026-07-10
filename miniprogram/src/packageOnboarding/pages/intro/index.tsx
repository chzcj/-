import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { syncBuildProgressToServer } from '@/services/buildState'

export default function OnboardingIntro() {
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
        copy='和网页版一样，需要先完成四段面谈式采集，再解锁交流、任务、预演与画像。进度会同步到服务器。'
      />
    </HiFiBuildShell>
  )
}

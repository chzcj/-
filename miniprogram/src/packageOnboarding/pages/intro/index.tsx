import { View, Text } from '@tarojs/components'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { getSessionToken } from '@/services/api'
import { markIntroSeen } from '@/services/onboardingFlags'
import { syncBuildProgressToServer } from '@/services/buildState'
import './index.scss'

const INTRO_TAGS = [
  '教育观念',
  '陪伴时长',
  '孩子性格',
  '学习状态',
  '兴趣特长',
  '情绪短板',
  '家庭矛盾',
  '教育方法',
] as const

export default function OnboardingIntro() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })
  const handleStart = async () => {
    markIntroSeen()
    if (getSessionToken()) {
      await syncBuildProgressToServer({ introSeen: true }).catch(() => {})
    }
    await mpGoReplace('/packageOnboarding/pages/hub/index')
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
      <View className='intro-body'>
        <Text className='intro-paragraph'>
          育见 AI 会完整梳理你们家的真实细节：大人的教育观念、陪伴时长、孩子性格、各科学习状态、兴趣特长、情绪短板、家庭矛盾，以及过往试过的教育方法。
        </Text>
        <View className='intro-tags'>
          {INTRO_TAGS.map((tag) => (
            <Text key={tag} className='intro-tag'>
              {tag}
            </Text>
          ))}
        </View>
        <Text className='intro-paragraph'>
          它会记住孩子长期以来所有的变化，逐步形成只属于这个孩子、这个家庭的专属成长模型。
        </Text>
        <View className='intro-highlight'>
          <Text className='intro-highlight-label'>成长分身</Text>
          <Text className='intro-highlight-copy'>
            相当于为孩子打造了一个线上的专属 SecondMe
          </Text>
        </View>
      </View>
    </HiFiBuildShell>
  )
}

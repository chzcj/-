import { Text } from '@tarojs/components'
import { OnboardingInfoShell } from '@/components/onboarding/OnboardingInfoShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import './index.scss'

export default function OnboardingIntro() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })

  const handleContinue = () => {
    void mpGoReplace('/packageOnboarding/pages/guide/index')
  }

  return (
    <OnboardingInfoShell
      step={1}
      totalSteps={2}
      actionLabel='继续'
      onAction={handleContinue}
    >
      <Text className='onboarding-info-badge'>你好，欢迎来到育见</Text>
      <Text className='onboarding-info-title'>致家长的一封信</Text>
      <Text className='onboarding-info-paragraph'>
        育见是一款为家长设计的教育 AI 小程序。
      </Text>
      <Text className='onboarding-info-paragraph'>
        它是由
        <Text className='onboarding-info-em'>清华大学生命科学学院、计算机系师生团队</Text>
        一块做出来的。
      </Text>
      <Text className='onboarding-info-paragraph'>
        希望借助 AI，帮助家长更了解自己的孩子。
      </Text>
      <Text className='onboarding-info-paragraph'>
        它会慢慢认识孩子的学习、性格、情绪和成长经历，帮助家长更清楚地看见孩子，也更懂孩子。
      </Text>
    </OnboardingInfoShell>
  )
}

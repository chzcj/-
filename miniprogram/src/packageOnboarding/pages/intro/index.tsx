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
      <Text className='onboarding-info-badge'>你好，欢迎来到</Text>
      <Text className='onboarding-info-title'>育见</Text>
      <Text className='onboarding-info-paragraph'>
        育见是一款为孩子成长教育而设计的家长帮手。
      </Text>
      <Text className='onboarding-info-paragraph'>
        由<Text className='onboarding-info-em'>清华大学生命科学学院、计算机系师生携手共创</Text>。
      </Text>
      <Text className='onboarding-info-paragraph'>
        借助育见，家长可以更客观、全面地认识孩子，更懂孩子，也更能支持孩子健康成长。
      </Text>
      <Text className='onboarding-info-paragraph'>
        这里不评判谁对谁错。我们会从真实生活里，一起看见亲子双方的需要、理解和成长。
      </Text>
    </OnboardingInfoShell>
  )
}

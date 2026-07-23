import { View, Text } from '@tarojs/components'
import type { OnboardingExampleTone } from '@/data/onboardingInfoContent'
import './blocks.scss'

type Props = {
  tone: OnboardingExampleTone
  quote: string
  meta: string
}

export function OnboardingExampleCard({ tone, quote, meta }: Props) {
  return (
    <View className={`onboarding-example onboarding-example--${tone}`}>
      <View className='onboarding-example-body'>
        <Text className='onboarding-example-mark'>“</Text>
        <Text className='onboarding-example-copy'>{quote}</Text>
      </View>
      <Text className='onboarding-example-meta'>{meta}</Text>
    </View>
  )
}

import { View, Text } from '@tarojs/components'
import type { OnboardingLetterContent } from '@/data/onboardingInfoContent'
import './blocks.scss'

type Props = OnboardingLetterContent

export function OnboardingLetterBlock({
  badge,
  brandWord,
  ledeRest,
  accentParagraph,
  leadParagraph,
  closing,
}: Props) {
  return (
    <>
      <Text className='onboarding-info-badge'>{badge}</Text>
      <View className='onboarding-lede'>
        <Text className='onboarding-brand-word'>{brandWord}</Text>
        <Text className='onboarding-lede-rest'>{ledeRest}</Text>
      </View>
      <Text className='onboarding-paragraph onboarding-paragraph--accent'>{accentParagraph}</Text>
      <Text className='onboarding-paragraph onboarding-paragraph--lead'>{leadParagraph}</Text>
      <Text className='onboarding-closing'>{closing}</Text>
    </>
  )
}

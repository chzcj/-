import { View, Text } from '@tarojs/components'
import type { OnboardingGuideContent } from '@/data/onboardingInfoContent'
import { OnboardingExampleCard } from './OnboardingExampleCard'
import { OnboardingStoryInvite } from './OnboardingStoryInvite'
import './blocks.scss'

type Props = OnboardingGuideContent

export function OnboardingGuideBlock({
  titleLines,
  paragraph,
  tipTitle,
  tipCopy,
  examples,
  storyInviteEllipsis,
  storyInviteCopy,
  sendoff,
}: Props) {
  return (
    <>
      <Text className='onboarding-title'>
        {titleLines[0]}
        {'\n'}
        {titleLines[1]}
      </Text>
      <Text className='onboarding-paragraph'>{paragraph}</Text>
      <View className='onboarding-tip'>
        <Text className='onboarding-tip-title'>{tipTitle}</Text>
        <Text className='onboarding-tip-copy'>{tipCopy}</Text>
      </View>
      <View className='onboarding-examples'>
        {examples.map((ex) => (
          <OnboardingExampleCard key={ex.meta} tone={ex.tone} quote={ex.quote} meta={ex.meta} />
        ))}
      </View>
      <OnboardingStoryInvite ellipsis={storyInviteEllipsis} copy={storyInviteCopy} />
      <Text className='onboarding-sendoff'>{sendoff}</Text>
    </>
  )
}

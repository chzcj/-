import { View, Text } from '@tarojs/components'
import './blocks.scss'

type Props = {
  ellipsis: string
  copy: string
}

export function OnboardingStoryInvite({ ellipsis, copy }: Props) {
  return (
    <View className='onboarding-story-invite'>
      <Text className='onboarding-story-invite-ellipsis'>{ellipsis}</Text>
      <Text className='onboarding-story-invite-copy'>{copy}</Text>
    </View>
  )
}

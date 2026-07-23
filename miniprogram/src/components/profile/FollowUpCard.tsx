import { View, Text } from '@tarojs/components'
import './FollowUpCard.scss'

type FollowUpCardProps = {
  voicePrompt: string
}

export function FollowUpCard({ voicePrompt }: FollowUpCardProps) {
  return (
    <View className='soft-card follow-up-card'>
      <Text className='follow-up-card-label'>可以这样补充</Text>
      <Text className='follow-up-prompt'>{voicePrompt}</Text>
    </View>
  )
}

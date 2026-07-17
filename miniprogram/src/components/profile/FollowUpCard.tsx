import { View, Text } from '@tarojs/components'

type FollowUpCardProps = {
  voicePrompt?: string
}

export function FollowUpCard({ voicePrompt }: FollowUpCardProps) {
  return (
    <View className='summary-card follow-up-card'>
      {voicePrompt ? (
        <View className='follow-up-voice-prompt'>
          <Text className='section-label'>可以这样补充</Text>
          <Text className='summary-note'>{voicePrompt}</Text>
        </View>
      ) : null}
    </View>
  )
}

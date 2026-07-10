import { View, Text } from '@tarojs/components'

type FollowUpCardProps = {
  purpose: string
  directions?: string[]
  voicePrompt?: string
}

export function FollowUpCard({ purpose, directions = [], voicePrompt }: FollowUpCardProps) {
  return (
    <View className='summary-card follow-up-card'>
      <Text className='summary-card-title'>追问目的</Text>
      <Text className='summary-lead'>{purpose}</Text>
      {directions.length > 0 ? (
        <View className='follow-up-directions'>
          <Text className='section-label'>可以从这些方向补</Text>
          <View className='chips'>
            {directions.map((d) => (
              <Text key={d} className='chip'>
                {d}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      {voicePrompt ? (
        <View className='follow-up-voice-prompt'>
          <Text className='section-label'>可以这样补充</Text>
          <Text className='summary-note'>{voicePrompt}</Text>
        </View>
      ) : null}
    </View>
  )
}

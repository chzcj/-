import { View, Text } from '@tarojs/components'

type FollowUpCardProps = {
  purpose: string
  directions?: string[]
  voicePrompt?: string
}

function normalizeDirections(directions: string[] = []) {
  return directions.map((d) => d.trim()).filter(Boolean)
}

export function FollowUpCard({ purpose, directions = [], voicePrompt }: FollowUpCardProps) {
  const visibleDirections = normalizeDirections(directions)

  return (
    <View className='summary-card follow-up-card'>
      <Text className='summary-card-title'>追问目的</Text>
      <Text className='summary-lead'>{purpose}</Text>
      {visibleDirections.length > 0 ? (
        <View className='follow-up-directions'>
          <Text className='section-label'>可以从这些方向补</Text>
          <View className='chips'>
            {visibleDirections.map((d) => (
              <View key={d} className='chip'>
                <Text className='chip-text'>{d}</Text>
              </View>
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

import { View, Text } from '@tarojs/components'
import type { DailyThinkingChip } from '@yujian/contracts'

export function DailyThinkingPanel({ chips }: { chips: DailyThinkingChip[] }) {
  return (
    <View className='thinking-panel'>
      <View className='profile-stream'>
        {chips.map((chip, i) => (
          <View key={i} className='profile-chip'>
            <Text className='profile-chip-label'>{chip.label}</Text>
            <Text className='profile-chip-value'>{chip.text || '还在了解'}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

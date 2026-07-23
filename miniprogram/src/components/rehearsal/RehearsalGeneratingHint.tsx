import { View, Text } from '@tarojs/components'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { getChildDisplayName } from '@/services/childStorage'
import './RehearsalGeneratingHint.scss'

type Props = {
  /** confirm 卡片内 / chat 气泡内 */
  variant?: 'card' | 'bubble'
  label?: string
}

export function RehearsalGeneratingHint({ variant = 'card', label }: Props) {
  const childCopy = childSystemCopy(getChildDisplayName())
  const text = label || childCopy.simulatingReaction

  return (
    <View className={`rehearsal-generating${variant === 'bubble' ? ' rehearsal-generating--bubble' : ''}`}>
      <View className='rehearsal-generating-wave' aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} className='rehearsal-generating-wave-bar' />
        ))}
      </View>
      <Text className='rehearsal-generating-label'>{text}</Text>
    </View>
  )
}

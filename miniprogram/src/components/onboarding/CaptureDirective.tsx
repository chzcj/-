import { View, Text } from '@tarojs/components'
import { getEntryConfig, type EntryType } from '@/data/entryConfig'
import type { BuildEntryType } from '@/lib/buildEntries'
import './CaptureDirective.scss'

type Props = {
  entryType: EntryType | BuildEntryType | string
}

export function CaptureDirective({ entryType }: Props) {
  const config = getEntryConfig(entryType)

  return (
    <View className='soft-card capture-directive'>
      <Text className='capture-directive-lead'>{config.captureLead}</Text>
      <View className='capture-directive-points'>
        {config.capturePoints.map((point) => (
          <View key={point} className='capture-directive-point-row'>
            <Text className='capture-directive-bullet'>·</Text>
            <Text className='capture-directive-point'>{point}</Text>
          </View>
        ))}
      </View>
      <Text className='capture-directive-volume'>{config.captureVolumeHint}</Text>
      <Text className='capture-directive-hint'>{config.defaultHint}</Text>
    </View>
  )
}

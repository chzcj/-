import { View, Text } from '@tarojs/components'
import './PortraitMemoryHero.scss'

type Props = {
  childName: string
  monthLabel: string
  heroCopy: string
  pageCount: number
  weekPageDelta: number
  highlightCount: number
  completenessPct: number
  memoryCount: number
  onOpenHandbook?: () => void
  onOpenMoments?: () => void
  onOpenInsight?: () => void
  onOpenMemories?: () => void
}

export function PortraitMemoryHero({
  childName,
  monthLabel,
  heroCopy,
  pageCount,
  weekPageDelta,
  highlightCount,
  completenessPct,
  memoryCount,
  onOpenHandbook,
  onOpenMoments,
  onOpenInsight,
  onOpenMemories,
}: Props) {
  const title = childName ? `${childName}的${monthLabel}手账` : `${monthLabel}成长手账`

  return (
    <View className='portrait-memory-hero'>
      <View className='hero-top'>
        <View className='hero-copy-col'>
          <Text className='eyebrow'>育见 · 家庭成长手账</Text>
          <Text className='hero-title'>{title}</Text>
          <Text className='hero-copy'>{heroCopy}</Text>
        </View>
        <View className='page-seal' onClick={onOpenHandbook}>
          <View className='stack'>
            <View className='sheet s1' />
            <View className='sheet s2' />
            <View className='sheet s3'>
              <Text className='num'>{pageCount}</Text>
              <Text className='unit'>页手账</Text>
            </View>
          </View>
          {weekPageDelta > 0 ? (
            <Text className='delta'>
              近7天 <Text className='delta-em'>+{weekPageDelta}</Text>
            </Text>
          ) : null}
        </View>
      </View>
      <View className='hero-stats'>
        <View className='hero-stat' onClick={onOpenMoments}>
          <Text className='stat-num'>{highlightCount}</Text>
          <Text className='stat-label'>闪光时刻</Text>
        </View>
        <View className='hero-stat' onClick={onOpenInsight}>
          <Text className='stat-num'>{completenessPct}%</Text>
          <Text className='stat-label'>画像</Text>
        </View>
        <View className='hero-stat' onClick={onOpenMemories}>
          <Text className='stat-num'>{memoryCount}</Text>
          <Text className='stat-label'>手账记忆</Text>
        </View>
      </View>
    </View>
  )
}

import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './HandbookEmptyState.scss'

type Variant = 'memories' | 'moments'

const COPY: Record<Variant, { line: string; cta: string; daily?: boolean }> = {
  memories: {
    line: '手账记的是值得回看的瞬间，不是所有聊天记录',
    cta: '去日常交流',
    daily: true,
  },
  moments: {
    line: '闪光时刻来自交流里的亮点，继续记录后会在这里汇总',
    cta: '去日常交流',
    daily: true,
  },
}

type Props = {
  variant?: Variant
}

export function HandbookEmptyState({ variant = 'memories' }: Props) {
  const copy = COPY[variant]

  const goDaily = () => {
    void Taro.switchTab({ url: '/pages/daily/index' })
  }

  return (
    <View className='handbook-empty'>
      <View className='handbook-empty-art' aria-hidden>
        <View className='handbook-empty-sheet s1' />
        <View className='handbook-empty-sheet s2' />
        <View className='handbook-empty-sheet s3' />
      </View>
      <Text className='handbook-empty-line'>{copy.line}</Text>
      {copy.daily ? (
        <View className='handbook-empty-cta' onClick={goDaily}>
          <Text>{copy.cta}</Text>
        </View>
      ) : null}
    </View>
  )
}

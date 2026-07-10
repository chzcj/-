import { View, Text } from '@tarojs/components'
import type { StructuralTension } from '@/lib/portraitCard'
import './StructuralTensionCard.scss'

type Props = {
  tensions: StructuralTension[]
  title?: string
  compact?: boolean
}

export function StructuralTensionCard({
  tensions,
  title = '家庭结构里值得先看的张力',
  compact = false,
}: Props) {
  if (!tensions.length) return null

  return (
    <View className={`structural-tension-card${compact ? ' compact' : ''}`}>
      <Text className='structural-tension-title'>
        {title}
        {tensions.length > 1 ? `（${tensions.length} 个）` : ''}
      </Text>
      {tensions.map((t) => (
        <View key={`${t.title}-${t.detail}`} className='structural-tension-item'>
          <Text className='structural-tension-item-title'>{t.title}</Text>
          <Text className='structural-tension-item-body'>{t.detail}</Text>
          {t.confidence === 'low' ? (
            <Text className='hint-text'>仍在观察中，后续交流会继续修正。</Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

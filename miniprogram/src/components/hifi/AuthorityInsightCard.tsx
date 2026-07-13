import { View, Text } from '@tarojs/components'
import type { ReactNode } from 'react'
import './AuthorityInsightCard.scss'

type Props = {
  title?: string
  body: string
  children?: ReactNode
}

export function AuthorityInsightCard({ title = '育见解读', body, children }: Props) {
  return (
    <View className='authority-insight-card profile-block'>
      <Text className='authority-badge'>育见解读</Text>
      {/* badge 已固定显示「育见解读」，title 相同（含默认值）时不再重复渲染大标题 */}
      {title && title !== '育见解读' ? <Text className='authority-insight-title'>{title}</Text> : null}
      {body
        .split('\n')
        .filter(Boolean)
        .map((para) => (
          <Text key={para.slice(0, 24)} className='authority-insight-body'>
            {para}
          </Text>
        ))}
      {children}
    </View>
  )
}

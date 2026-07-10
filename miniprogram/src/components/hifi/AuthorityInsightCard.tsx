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
      <Text className='authority-badge'>清北学霸 · 家庭智慧</Text>
      {title ? <Text className='authority-insight-title'>{title}</Text> : null}
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

import { ScrollView, View, Text } from '@tarojs/components'
import type { HubProfileCard } from '@/lib/portraitCard'
import './PortraitTileStrip.scss'

const TILE_BADGE: Record<string, string> = {
  growth: '成长画像',
  focus: '长期关注',
  behavior: '行为模式',
  interaction: '亲子互动',
  strategies: '好方法',
  tensions: '成长阻力',
  hypotheses: '作业机制',
}

type Props = {
  cards: HubProfileCard[]
  onOpenCard: (slug: string) => void
  onOpenAll?: () => void
}

function tileBody(text: string): string {
  const t = (text || '').trim()
  if (t.length <= 42) return t
  return `${t.slice(0, 40).replace(/[，,。：:；;…]$/, '')}…`
}

export function PortraitTileStrip({ cards, onOpenCard, onOpenAll }: Props) {
  if (!cards.length) return null

  return (
    <View className='portrait-tile-strip'>
      <View className='strip-head'>
        <Text className='strip-title'>画像卡片</Text>
        {onOpenAll ? (
          <Text className='strip-link' onClick={onOpenAll}>
            全部 ›
          </Text>
        ) : null}
      </View>
      <ScrollView scrollX enhanced showScrollbar={false} className='media-strip'>
        {cards.map((card, index) => {
          const variant = `t${(index % 4) + 1}`
          return (
            <View
              key={card.slug}
              className={`portrait-tile ${variant}`}
              onClick={() => onOpenCard(card.slug)}
            >
              <Text className='tile-badge'>{TILE_BADGE[card.slug] || card.title}</Text>
              <View className='tile-glass'>
                <Text className='tile-cap'>{tileBody(card.body)}</Text>
                <Text className='tile-sub'>完整度 {card.progress}%</Text>
                <View className='tile-mini-bar'>
                  <View className='tile-mini-fill' style={{ width: `${card.progress}%` }} />
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

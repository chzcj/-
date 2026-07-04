'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

const FALLBACK_CARDS = [
  { label: '年级', value: '—' },
  { label: '最近冲突场景', value: '作业开始前' },
  { label: '学习特点', value: '理解力不弱，但怕出错' },
  { label: '亲子互动', value: '提醒后容易抗拒' },
]

type Card = { label: string; value: string }

export function ThinkingFlowCards({ active }: { active: boolean }) {
  const [index, setIndex] = useState(0)
  const [cards, setCards] = useState<Card[]>(FALLBACK_CARDS)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    apiClient.getProfileSnapshot().then((result) => {
      if (cancelled || !result.ok) return
      const snap = result.data
      const dynamic: Card[] = []
      if (snap.currentFocus) dynamic.push({ label: '当前关注', value: snap.currentFocus })
      if (snap.recentChanges?.[0]?.title) {
        dynamic.push({ label: '近期线索', value: snap.recentChanges[0].title })
      }
      if (dynamic.length) setCards([...dynamic, ...FALLBACK_CARDS].slice(0, 5))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [active])

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % cards.length), 1400)
    return () => window.clearInterval(timer)
  }, [active, cards.length])

  if (!active) return null

  const card = cards[index]

  return (
    <div className="thinking-flow" aria-live="polite">
      <div className="thinking-flow-spinner" aria-hidden />
      <p className="thinking-flow-hint">正在结合孩子的历史信息思考</p>
      <div className="thinking-flow-card" key={`${card.label}-${index}`}>
        <span className="thinking-flow-label">{card.label}</span>
        <span className="thinking-flow-value">{card.value}</span>
      </div>
    </div>
  )
}

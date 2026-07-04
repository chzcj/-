'use client'

import { HiFiMascot } from '@/components/hifi/HiFiMascot'

type HiFiBuildHeroProps = {
  title: string
  copy?: string
  kicker?: string
  compact?: boolean
  mascot?: boolean
}

/** 对齐高保真采集流 hero-card：标题在卡片内，可选吉祥物 */
export function HiFiBuildHero({ title, copy, kicker, compact = false, mascot = true }: HiFiBuildHeroProps) {
  return (
    <article className={`hero-card${compact ? ' compact' : ''}${mascot ? ' has-mascot' : ''}`}>
      {kicker ? <span className="module-kicker">{kicker}</span> : null}
      <h2 className="hero-title">{title}</h2>
      {copy ? <p className="hero-copy">{copy}</p> : null}
      {mascot ? <HiFiMascot /> : null}
    </article>
  )
}

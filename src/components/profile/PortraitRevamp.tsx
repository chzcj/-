'use client'

import type { HandbookPack, WeeklyHandbook, TimeCapsuleTeaser, MemoryFeedItem } from '@/types/handbook-pack'
import type { HubProfileCard } from '@/lib/profile/hub-profile-cards'

const FEED_TYPE_LABEL: Record<string, string> = {
  voice: '冲突语音',
  diary: '随笔',
  shine: '闪光时刻',
  hard: '家庭难题',
}

function previewTitle(item: MemoryFeedItem) {
  return item.displayLine || item.title || item.keyword
}

const TILE_BADGE: Record<string, string> = {
  growth: '成长画像',
  focus: '长期关注',
  behavior: '行为模式',
  interaction: '亲子互动',
  strategies: '好方法',
  tensions: '成长阻力',
  hypotheses: '作业机制',
}

type HeroProps = {
  childName: string
  monthLabel: string
  heroCopy: string
  pageCount: number
  weekPageDelta: number
  highlightCount: number
  completenessPct: number
  memoryCount: number
  onOpenHandbook: () => void
  onOpenMoments: () => void
  onOpenInsight: () => void
  onOpenMemories: () => void
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
}: HeroProps) {
  const title = childName ? `${childName}的${monthLabel}手账` : `${monthLabel}成长手账`

  return (
    <section className="portrait-memory-hero">
      <div className="hero-top">
        <div className="hero-copy-col">
          <span className="portrait-eyebrow">育见 · 家庭成长手账</span>
          <h2 className="portrait-hero-title">{title}</h2>
          <p className="portrait-hero-copy">{heroCopy}</p>
        </div>
        <button type="button" className="page-seal" onClick={onOpenHandbook} aria-label="查看手账页数">
          <div className="page-seal-stack">
            <span className="page-seal-sheet s1" aria-hidden="true" />
            <span className="page-seal-sheet s2" aria-hidden="true" />
            <span className="page-seal-sheet s3">
              <span className="page-seal-num">{pageCount}</span>
              <span className="page-seal-unit">页手账</span>
            </span>
          </div>
          {weekPageDelta > 0 ? (
            <span className="page-seal-delta">
              近7天 <strong>+{weekPageDelta}</strong>
            </span>
          ) : null}
        </button>
      </div>
      <div className="hero-stats">
        <button type="button" className="hero-stat" onClick={onOpenMoments}>
          <strong>{highlightCount}</strong>
          <span>闪光时刻</span>
        </button>
        <button type="button" className="hero-stat" onClick={onOpenInsight}>
          <strong>{completenessPct}%</strong>
          <span>画像</span>
        </button>
        <button type="button" className="hero-stat" onClick={onOpenMemories}>
          <strong>{memoryCount}</strong>
          <span>手账记忆</span>
        </button>
      </div>
    </section>
  )
}

type StripProps = {
  cards: HubProfileCard[]
  onOpenCard: (slug: string) => void
  onOpenAll: () => void
}

export function PortraitTileStrip({ cards, onOpenCard, onOpenAll }: StripProps) {
  if (!cards.length) return null

  return (
    <div className="portrait-tile-strip">
      <div className="strip-head">
        <h3>画像卡片</h3>
        <button type="button" className="strip-link" onClick={onOpenAll}>
          全部 ›
        </button>
      </div>
      <div className="media-strip">
        {cards.map((card, index) => {
          const variant = `t${(index % 4) + 1}`
          return (
            <button
              key={card.slug}
              type="button"
              className={`portrait-tile ${variant}`}
              onClick={() => onOpenCard(card.slug)}
            >
              <span className="tile-badge">{TILE_BADGE[card.slug] || card.title}</span>
              <span className="tile-glass">
                <span className="tile-cap">{card.body}</span>
                <span className="tile-sub">完整度 {card.progress}%</span>
                <span className="tile-mini-bar">
                  <span className="tile-mini-fill" style={{ width: `${card.progress}%` }} />
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

type HandbookProps = {
  handbook: WeeklyHandbook | null
  timeCapsule: TimeCapsuleTeaser | null
  previewItems?: MemoryFeedItem[]
  onOpenHandbook: () => void
  onOpenMemories: (e: React.MouseEvent) => void
  onOpenTimeCapsule: () => void
}

export function WeeklyHandbookCard({
  handbook,
  timeCapsule,
  previewItems = [],
  onOpenHandbook,
  onOpenMemories,
  onOpenTimeCapsule,
}: HandbookProps) {
  const weekLabel = handbook?.weekRangeLabel || '近7天'
  const hasPreview = previewItems.length > 0
  const isEmpty = handbook?.source === 'empty' || handbook?.source === 'fallback'

  return (
    <>
      <article className="weekly-handbook" onClick={onOpenHandbook} role="button" tabIndex={0}>
        <div className="handbook-cover">
          <p className="handbook-month">{weekLabel}</p>
          <h4 className="handbook-headline">{handbook?.headline || '近7天还在积累记忆'}</h4>
          <p className="handbook-blurb">
            {handbook?.coverBlurb ||
              '交流、任务反馈与随笔会在这里收成可回看的近7天记忆。'}
          </p>
        </div>
        <div className="handbook-body">
          {hasPreview ? (
            <div className="hb-preview-list">
              {previewItems.slice(0, 3).map((item) => (
                <a
                  key={item.id}
                  href={`/family-profile/memory/${encodeURIComponent(item.id)}`}
                  className="hb-preview-row"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="hb-preview-line">{previewTitle(item)}</span>
                  <span className="hb-preview-type">{FEED_TYPE_LABEL[item.type] || item.type}</span>
                </a>
              ))}
            </div>
          ) : isEmpty ? (
            <p className="handbook-empty-inline-line">
              手账记的是值得回看的瞬间，不是所有聊天记录
            </p>
          ) : (
            <>
              <div className="hb-row">
                <strong className="hb-row-label">阶段性亮点</strong>
                <span className="hb-row-text">
                  {handbook?.highlight || '继续记录后，亮点会出现在这里。'}
                </span>
              </div>
              <div className="hb-row">
                <strong className="hb-row-label">关系瞬间</strong>
                <span className="hb-row-text">
                  {handbook?.relationMoment || '语音与随笔里的关系瞬间会在这里汇总。'}
                </span>
              </div>
              <div className="hb-row" onClick={(e) => { e.stopPropagation(); onOpenTimeCapsule() }} role="presentation">
                <strong className="hb-row-label">对比上次</strong>
                <span className="hb-row-text">
                  {handbook?.compareLastWeek || '积累足够记忆后，可与上一阶段对比回看。'}
                </span>
              </div>
            </>
          )}
          <button type="button" className="cta-handbook" onClick={onOpenMemories}>
            查看近7天记忆
          </button>
        </div>
      </article>

      {timeCapsule ? (
        <button type="button" className="years-ago" onClick={onOpenTimeCapsule}>
          <span className="years-stamp">
            对比
            <br />
            上次
          </span>
          <span className="years-txt">
            <strong className="years-title">{timeCapsule.teaserTitle}</strong>
            <span className="years-sub">{timeCapsule.teaserSubtitle}</span>
          </span>
        </button>
      ) : null}
    </>
  )
}

export const DEFAULT_HANDBOOK_PACK: HandbookPack = {
  hero: {
    childName: '',
    monthLabel: '',
    heroCopy: '交流、任务反馈与随笔会在这里慢慢收成你们家自己的成长回忆。',
    pageCount: 0,
    weekPageDelta: 0,
  },
  stats: { highlightCount: 0, completenessPct: 0, memoryCount: 0 },
  handbook: null,
  memoryFeed: [],
  memoryFeedRecent: [],
  memoryFeedPreview: [],
  highlightMoments: [],
  timeCapsule: null,
  timeCapsuleSnapshot: null,
  archiveWeeks: [],
  refreshedAt: '',
  watermark: { handbookStale: true, memoryStale: true, partiallyRefreshing: false, handbookRefreshing: false },
}

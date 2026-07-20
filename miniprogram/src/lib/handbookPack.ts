/** 画像 Tab 成长手账 BFF 契约（对齐 GET /api/profile/handbook-pack） */

export type HighlightMoment = {
  title: string
  teaser: string
  whyHighlighted?: string
  sourceRef?: string
}

export type MemoryFeedType = 'voice' | 'diary' | 'shine' | 'hard'

export type MemoryFeedItem = {
  id: string
  type: MemoryFeedType
  keyword: string
  snippet: string
  displayLine?: string
  teaser?: string
  whyIncluded?: string
  occurredAt: string
  sourceRef: string
  title?: string
  durationLabel?: string
  linkedTrajectoryId?: string
}

export type WeeklyHandbook = {
  weekKey: string
  weekRangeLabel: string
  headline: string
  coverBlurb: string
  heroCopy: string
  highlight: string
  relationMoment: string
  compareLastWeek: string
  coverStory?: string
  weekInventory?: string[]
  refreshedAt: string
  source: 'llm' | 'fallback' | 'empty'
}

export type TimeCapsuleTeaser = {
  teaserTitle: string
  teaserSubtitle: string
  periodLabel?: string
}

export type TimeCapsuleSnapshot = {
  periodLabel: string
  thenLabel: string
  nowLabel: string
  teaserTitle?: string
  teaserSubtitle?: string
  thenSnapshot: string
  nowSnapshot: string
  thenQuote?: string
  relationShift?: string
  refreshedAt: string
  thenWeekKey?: string
  nowWeekKey?: string
}

export type HandbookPack = {
  hero: {
    childName: string
    monthLabel: string
    heroCopy: string
    pageCount: number
    weekPageDelta: number
  }
  stats: {
    highlightCount: number
    completenessPct: number
    memoryCount: number
  }
  handbook: WeeklyHandbook | null
  memoryFeed: MemoryFeedItem[]
  memoryFeedRecent: MemoryFeedItem[]
  memoryFeedPreview: MemoryFeedItem[]
  highlightMoments: HighlightMoment[]
  timeCapsule: TimeCapsuleTeaser | null
  timeCapsuleSnapshot: TimeCapsuleSnapshot | null
  archiveWeeks: Array<{ weekLabel: string; handbookId: string }>
  refreshedAt: string
  watermark: {
    handbookStale: boolean
    memoryStale: boolean
    partiallyRefreshing: boolean
    handbookRefreshing?: boolean
  }
}

export type MemoryMomentDetail = {
  item: MemoryFeedItem
  kicker: string
  title: string
  lead?: string
  whyIncluded?: string
  evidenceBody?: string
  body?: string
  keyQuotes?: string[]
  interpretation?: string
  playUrl?: string | null
}

export const FEED_TYPE_LABEL: Record<MemoryFeedType, string> = {
  voice: '冲突语音',
  diary: '随笔',
  shine: '闪光时刻',
  hard: '家庭难题',
}

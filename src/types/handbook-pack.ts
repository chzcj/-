import type { HighlightMoment } from '@/types/highlight-moment'

export type MemoryFeedType = 'voice' | 'diary' | 'shine' | 'hard'

export type HandbookAdmissionSource =
  | 'rehearsal_voice'
  | 'how_to_speak'
  | 'task_shine'
  | 'highlight_moment'
  | 'trajectory_hard'
  | 'episode_atom'
  | 'journal'

export type HandbookPage = {
  pageId: string
  source: HandbookAdmissionSource
  sourceRef: string
  occurredAt: string
  displayLine: string
  /** 准入时原始证据（详情溯源真源） */
  rawEvidence?: string
  /** episode summary / 场景标题等补充上下文 */
  contextSummary?: string
  titleHint?: string
  teaser?: string
  whyIncluded?: string
  evidenceRef?: string
  weekKey: string
  /** 准入 job 润色完成前可为 false */
  polished?: boolean
}

export type MemoryFeedItem = {
  id: string
  type: MemoryFeedType
  keyword: string
  snippet: string
  /** 润色后主文案（12–24 字）；有则 UI 优先展示 */
  displayLine?: string
  teaser?: string
  whyIncluded?: string
  source?: HandbookAdmissionSource
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
  /** L1 小字：对比时间跨度，如「对比 · 上周 vs 本周」 */
  periodLabel?: string
}

export type TimeCapsuleSnapshot = {
  periodLabel: string
  thenLabel: string
  nowLabel: string
  /** L1 主标题（≤28 字），勿与 thenSnapshot 混用 */
  teaserTitle: string
  /** L1 副句（≤56 字） */
  teaserSubtitle: string
  thenSnapshot: string
  nowSnapshot: string
  thenQuote?: string
  relationShift?: string
  refreshedAt: string
  /** 对比锚点 weekKey（代码写入，非 LLM 臆造） */
  thenWeekKey?: string
  nowWeekKey?: string
}

export type HandbookPackHero = {
  childName: string
  monthLabel: string
  heroCopy: string
  pageCount: number
  weekPageDelta: number
}

export type HandbookPackStats = {
  highlightCount: number
  completenessPct: number
  memoryCount: number
}

export type HandbookPackWatermark = {
  handbookStale: boolean
  memoryStale: boolean
  partiallyRefreshing: boolean
  /** 手账全量重刷进行中（purge/backfill/polish） */
  handbookRefreshing?: boolean
}

export type HandbookPack = {
  hero: HandbookPackHero
  stats: HandbookPackStats
  handbook: WeeklyHandbook | null
  /** 全历史准入页 */
  memoryFeed: MemoryFeedItem[]
  /** 近7天滚动窗口 */
  memoryFeedRecent: MemoryFeedItem[]
  /** 近7天 Top3 预览（画像页） */
  memoryFeedPreview: MemoryFeedItem[]
  highlightMoments: HighlightMoment[]
  timeCapsule: TimeCapsuleTeaser | null
  timeCapsuleSnapshot: TimeCapsuleSnapshot | null
  archiveWeeks: Array<{ weekLabel: string; handbookId: string }>
  refreshedAt: string
  watermark: HandbookPackWatermark
}

export type MemoryMomentDetail = {
  item: MemoryFeedItem
  kicker: string
  title: string
  lead?: string
  /** 01 为什么进手账 */
  whyIncluded?: string
  /** 原始证据 / 追溯正文（供 keyQuotes 抽取） */
  evidenceBody?: string
  /** @deprecated 兼容旧客户端，等同 whyIncluded */
  body?: string
  keyQuotes?: string[]
  interpretation?: string
  playUrl?: string | null
}

export function timeCapsuleToTeaser(snap: TimeCapsuleSnapshot | null): TimeCapsuleTeaser | null {
  if (!snap) return null
  const title = snap.teaserTitle?.trim() || snap.thenSnapshot.slice(0, 28)
  const sub = snap.teaserSubtitle?.trim() || snap.nowSnapshot.slice(0, 56)
  if (!title && !sub) return null
  return {
    teaserTitle: title,
    teaserSubtitle: sub,
    periodLabel: snap.periodLabel,
  }
}

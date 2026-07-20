import 'server-only'

import { createHash } from 'node:crypto'
import type { TenantId } from '@/lib/server/memory/tenant'
import {
  getChildBasicInfo,
  getLatestBuiltProfileSnapshot,
} from '@/lib/server/memory/database-manager'
import { loadDailyUiSnapshot } from '@/lib/server/profile/daily-refresh-agent'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import {
  buildMemoryFeedForRollingWindow,
  feedTypeLabel,
  memoryFeedContentHash,
} from '@/lib/server/profile/memory-feed'
import { loadWeeklyHandbook } from '@/lib/server/profile/handbook-store'
import {
  getRollingWindowKey,
  getRollingWindowRangeLabel,
  previousRollingWindowKey,
} from '@/lib/server/profile/rolling-window'
import { getMonthLabel } from '@/lib/server/profile/week-utils'
import type { HighlightMoment } from '@/types/highlight-moment'
import type { WeeklyHandbook } from '@/types/handbook-pack'
import { normalizeHighlightsInput } from '@/types/highlight-moment'

export type HandbookReadPack = {
  weekKey: string
  weekRangeLabel: string
  childName: string
  monthLabel: string
  memoryFeedSummary: Record<string, number>
  feedItems: Array<{
    type: string
    occurredAt: string
    keyword: string
    snippet: string
    sourceRef: string
  }>
  highlightMoments: HighlightMoment[]
  childQuotes: string[]
  taskFeedbackSnippets: string[]
  portraitDigestOneLiner: string
  previousWeekHandbook: WeeklyHandbook | null
  materialThreshold: { met: boolean; reason: string }
  contentHash: string
}

export async function gatherHandbookContext(tenant: TenantId): Promise<HandbookReadPack> {
  const weekKey = getRollingWindowKey()
  const feedItems = await buildMemoryFeedForRollingWindow(tenant)
  const summary: Record<string, number> = { voice: 0, diary: 0, shine: 0, hard: 0, total: feedItems.length }
  for (const it of feedItems) summary[it.type] = (summary[it.type] || 0) + 1

  const [basic, built, uiSnap, digest, prevHandbook] = await Promise.all([
    getChildBasicInfo(tenant),
    getLatestBuiltProfileSnapshot(tenant),
    loadDailyUiSnapshot(tenant),
    buildDeepModelDigest(tenant).catch(() => null),
    loadWeeklyHandbook(tenant, previousRollingWindowKey(weekKey)),
  ])

  const digestPack = pickDeepModelDigestPack(digest, { forceThick: true })
  const childQuotes = (digestPack.childQuotes || []).slice(0, 12)
  const highlightMoments = normalizeHighlightsInput(
    (uiSnap as { highlightMoments?: HighlightMoment[]; highlights?: string[] })?.highlightMoments ||
      uiSnap?.highlights
  )

  const taskFeedbackSnippets = feedItems
    .filter((f) => f.type === 'shine')
    .map((f) => f.snippet)
    .slice(0, 8)

  const effectiveL1 = feedItems.length
  const materialThreshold =
    effectiveL1 >= 2
      ? { met: true, reason: 'feed>=2' }
      : { met: false, reason: '近7天可回看记忆不足 2 条' }

  const contentHash = createHash('sha256')
    .update(
      [
        memoryFeedContentHash(feedItems),
        highlightMoments.map((h) => h.id).join(','),
        digestPack.mechanismNarrative?.slice(0, 200) || '',
      ].join('|')
    )
    .digest('hex')
    .slice(0, 16)

  return {
    weekKey,
    weekRangeLabel: getRollingWindowRangeLabel(),
    childName: basic?.nickname?.trim() || '孩子',
    monthLabel: getMonthLabel(),
    memoryFeedSummary: summary,
    feedItems: feedItems.slice(0, 20).map((f) => ({
      type: feedTypeLabel(f.type),
      occurredAt: f.occurredAt,
      keyword: f.keyword,
      snippet: f.displayLine || f.snippet,
      displayLine: f.displayLine,
      sourceRef: f.sourceRef,
    })),
    highlightMoments,
    childQuotes,
    taskFeedbackSnippets,
    portraitDigestOneLiner: (digestPack.mechanismNarrative || built?.coreJudgment || '').slice(0, 120),
    previousWeekHandbook: prevHandbook,
    materialThreshold,
    contentHash,
  }
}

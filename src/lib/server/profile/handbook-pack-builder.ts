import 'server-only'

import type { TenantId } from '@/lib/server/memory/tenant'
import {
  getChildBasicInfo,
  getLatestBuiltProfileSnapshot,
} from '@/lib/server/memory/database-manager'
import { loadDailyUiSnapshot } from '@/lib/server/profile/daily-refresh-agent'
import {
  buildMemoryFeedAll,
  buildMemoryFeedForRollingWindow,
  computePageMetrics,
} from '@/lib/server/profile/handbook-admission'
import {
  listHandbookArchiveWeeks,
  loadTimeCapsuleSnapshot,
  loadWeeklyHandbook,
} from '@/lib/server/profile/handbook-store'
import { timeCapsuleToTeaser } from '@/lib/server/profile/time-capsule'
import {
  formatRollingWindowRange,
  formatRollingWindowShort,
  getRollingWindowKey,
  previousRollingWindowKey,
} from '@/lib/server/profile/rolling-window'
import { getMonthLabel } from '@/lib/server/profile/week-utils'
import { curateMemoryFeedPreview } from '@/lib/server/profile/handbook-preview-curation'
import { isHandbookRefreshing } from '@/lib/server/profile/handbook-refresh-orchestrator'
import { normalizeHighlightsInput } from '@/types/highlight-moment'
import type { HandbookPack, TimeCapsuleSnapshot } from '@/types/handbook-pack'

/** 旧快照无 teaser 字段 / LLM 臆造「3 个月前」时在读路径修正 */
function normalizeTimeCapsuleSnapshot(
  raw: TimeCapsuleSnapshot | null,
  windowKey = getRollingWindowKey()
): TimeCapsuleSnapshot | null {
  if (!raw) return null
  const thenWk = raw.thenWeekKey || previousRollingWindowKey(windowKey)
  const nowWk = raw.nowWeekKey || windowKey
  const stalePeriod = /个月|90\s*天|三个月/i.test(raw.periodLabel || '')
  const labels = stalePeriod || !raw.thenWeekKey
    ? {
        periodLabel: `对比 · ${formatRollingWindowShort(thenWk)} vs ${formatRollingWindowShort(nowWk)}`,
        thenLabel: `上次 · ${formatRollingWindowRange(thenWk)}`,
        nowLabel: `这次 · ${formatRollingWindowRange(nowWk)}`,
        thenWeekKey: thenWk,
        nowWeekKey: nowWk,
      }
    : {
        periodLabel: raw.periodLabel,
        thenLabel: raw.thenLabel,
        nowLabel: raw.nowLabel,
        thenWeekKey: raw.thenWeekKey,
        nowWeekKey: raw.nowWeekKey,
      }

  const teaserTitle =
    raw.teaserTitle?.trim() ||
    (raw.thenSnapshot.length <= 28 ? raw.thenSnapshot : raw.thenSnapshot.slice(0, 28))
  const teaserSubtitle =
    raw.teaserSubtitle?.trim() ||
    (raw.nowSnapshot.length <= 56 ? raw.nowSnapshot : raw.nowSnapshot.slice(0, 56))

  return { ...raw, ...labels, teaserTitle, teaserSubtitle }
}

/** 读路径：只读快照 + 准入层计数，禁止请求内同步 rebuild */
export async function buildHandbookPack(tenant: TenantId): Promise<HandbookPack> {
  const windowKey = getRollingWindowKey()
  const [basic, built, uiSnap, handbook, capsule, archive, memoryFeedAll, memoryFeedRecent, pageMetrics] =
    await Promise.all([
      getChildBasicInfo(tenant),
      getLatestBuiltProfileSnapshot(tenant),
      loadDailyUiSnapshot(tenant),
      loadWeeklyHandbook(tenant, windowKey),
      loadTimeCapsuleSnapshot(tenant),
      listHandbookArchiveWeeks(tenant, 4),
      buildMemoryFeedAll(tenant),
      buildMemoryFeedForRollingWindow(tenant),
      computePageMetrics(tenant),
    ])

  const memoryFeed = memoryFeedAll
  const memoryFeedPreview = curateMemoryFeedPreview(memoryFeedRecent, 3)

  const highlightMoments = normalizeHighlightsInput(
    (uiSnap as { highlightMoments?: unknown; highlights?: unknown })?.highlightMoments ||
      uiSnap?.highlights
  )

  const childName = basic?.nickname?.trim() || '孩子'
  const completeness = built?.completeness ?? 0
  const capsuleNorm = normalizeTimeCapsuleSnapshot(capsule, windowKey)
  const handbookRefreshing = await isHandbookRefreshing(tenant).catch(() => false)

  const heroCopy =
    handbook?.heroCopy ||
    (memoryFeedRecent.length >= 2
      ? '近7天沉淀了一些交流记忆。不是数据报告——是你们家自己的成长回忆。'
      : '近7天还没有足够记忆。交流、任务反馈或写随笔，都会慢慢厚起来。')

  return {
    hero: {
      childName,
      monthLabel: getMonthLabel(),
      heroCopy,
      pageCount: pageMetrics.pageCount,
      weekPageDelta: pageMetrics.weekPageDelta,
    },
    stats: {
      highlightCount: highlightMoments.length,
      completenessPct: completeness,
      memoryCount: memoryFeed.length,
    },
    handbook,
    memoryFeed,
    memoryFeedRecent,
    memoryFeedPreview,
    highlightMoments,
    timeCapsule: timeCapsuleToTeaser(capsuleNorm),
    timeCapsuleSnapshot: capsuleNorm,
    archiveWeeks: archive,
    refreshedAt: handbook?.refreshedAt || new Date().toISOString(),
    watermark: {
      handbookStale: !handbook || handbook.source === 'empty',
      memoryStale: memoryFeed.length === 0,
      partiallyRefreshing: handbookRefreshing,
      handbookRefreshing,
    },
  }
}

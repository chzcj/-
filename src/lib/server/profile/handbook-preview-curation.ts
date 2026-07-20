import type { MemoryFeedItem, MemoryFeedType } from '@/types/handbook-pack'
import { isBadHandbookPage } from '@/lib/server/profile/handbook-quality-gate'

const TYPE_SCORE: Record<MemoryFeedType, number> = {
  voice: 30,
  shine: 25,
  diary: 15,
  hard: 5,
}

function itemScore(item: MemoryFeedItem): number {
  let score = TYPE_SCORE[item.type] ?? 10
  const line = item.displayLine || item.snippet || ''
  if (item.teaser && item.teaser !== line) score += 8
  if (item.whyIncluded && item.whyIncluded.length >= 30) score += 6
  if (line.length >= 10 && line.length <= 24) score += 4
  if (/本周出现|记录下当前|交流了?\d+次/u.test(line)) score -= 20
  if (isBadHandbookPage(line, line, item.source)) score -= 50
  return score
}

/** 近7天 Top3：按信息密度策展，非时间序前3 */
export function curateMemoryFeedPreview(items: MemoryFeedItem[], limit = 3): MemoryFeedItem[] {
  const seen = new Set<string>()
  return [...items]
    .sort((a, b) => itemScore(b) - itemScore(a))
    .filter((item) => {
      const key = (item.displayLine || item.snippet || '').trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return !isBadHandbookPage(key, key, item.source)
    })
    .slice(0, limit)
}

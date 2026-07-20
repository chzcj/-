/** @deprecated 实现已迁至 handbook-admission.ts；保留 re-export 供旧 import */
export {
  buildMemoryFeedForWeek,
  buildMemoryFeedForRollingWindow,
  buildMemoryFeedAll,
  computePageMetrics,
  feedTypeLabel,
  memoryFeedContentHash,
  scanHandbookAdmissionCandidates,
  admitHandbookCandidates,
} from '@/lib/server/profile/handbook-admission'

export { handbookPageId } from '@/lib/server/profile/handbook-pages-store'
export { handbookPageToFeedItem } from '@/lib/profile/handbook-feed-map'

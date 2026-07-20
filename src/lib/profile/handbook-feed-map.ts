import type { HandbookAdmissionSource, HandbookPage, MemoryFeedItem, MemoryFeedType } from '@/types/handbook-pack'
import { hasTraceableRawEvidence } from '@/lib/profile/handbook-evidence'

export function handbookPageId(source: string, sourceRef: string) {
  return `${source}:${sourceRef}`
}

function sourceToFeedType(source: HandbookAdmissionSource): MemoryFeedType {
  switch (source) {
    case 'rehearsal_voice':
      return 'voice'
    case 'task_shine':
    case 'highlight_moment':
      return 'shine'
    case 'trajectory_hard':
      return 'hard'
    case 'journal':
    case 'episode_atom':
    case 'how_to_speak':
    default:
      return 'diary'
  }
}

function feedTypeLabelFromSource(source: HandbookAdmissionSource): string {
  switch (source) {
    case 'rehearsal_voice':
      return '冲突语音'
    case 'how_to_speak':
      return '怎么开口'
    case 'task_shine':
    case 'highlight_moment':
      return '闪光时刻'
    case 'trajectory_hard':
      return '家庭难题'
    case 'episode_atom':
      return '交流片段'
    case 'journal':
      return '随笔'
    default:
      return '记忆'
  }
}

function keywordFromText(text: string): string {
  const q = text.match(/[「『"]([^」』"]{2,12})[」』"]/)
  if (q?.[1]) return q[1]
  const t = text.trim()
  if (t.length <= 8) return t
  return t.length <= 8 ? t : `${t.slice(0, 8)}…`
}

/** 将 HandbookPage 转为 UI 消费的 MemoryFeedItem（纯函数，可单测） */
export function handbookPageToFeedItem(page: HandbookPage): MemoryFeedItem {
  const type = sourceToFeedType(page.source)
  const line = page.displayLine?.trim() || page.rawEvidence?.trim() || page.sourceRef.slice(0, 24)
  const teaser = page.teaser?.trim()
  const snippet = teaser && teaser !== line ? teaser : ''
  return {
    id: `page:${page.pageId}`,
    type,
    keyword: keywordFromText(page.rawEvidence || line),
    snippet,
    displayLine: line,
    teaser: teaser && teaser !== line ? teaser : undefined,
    whyIncluded: page.whyIncluded,
    source: page.source,
    occurredAt: page.occurredAt,
    sourceRef: page.sourceRef,
    title: feedTypeLabelFromSource(page.source),
    durationLabel: page.source === 'rehearsal_voice' ? '录音' : undefined,
    linkedTrajectoryId: page.source === 'trajectory_hard' ? page.sourceRef : undefined,
    hasRawEvidence: hasTraceableRawEvidence(page.rawEvidence),
  }
}

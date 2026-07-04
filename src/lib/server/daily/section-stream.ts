import 'server-only'

import type { DailySection } from '@/types/daily-message'
import {
  assertParentFacingText,
  filterParentFacingList,
} from '@/lib/server/daily/parent-facing-filter'

const SECTION_MARKER_RE = /---section:([a-z0-9_]+)---/g
const TASK_MARKER = '---task---'

type SectionCopyPatch = {
  id: string
  paragraphs?: string[]
  items?: string[]
  quotes?: string[]
  note?: string
}

export function rawTextToPatch(skeleton: DailySection, raw: string): SectionCopyPatch {
  const text = raw.trim()
  if (!text) return { id: skeleton.id }

  if (skeleton.kind === 'list') {
    const items = text
      .split(/\n/)
      .map((l) => l.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
    return { id: skeleton.id, items }
  }

  if (skeleton.kind === 'quotes') {
    const quotes = text
      .split(/\n/)
      .map((l) => l.replace(/^["「]|["」]$/g, '').trim())
      .filter(Boolean)
    return { id: skeleton.id, quotes }
  }

  if (skeleton.kind === 'mixed') {
    const items: string[] = []
    const paragraphs: string[] = []
    for (const line of text.split(/\n/)) {
      const t = line.trim()
      if (!t) continue
      if (/^[-•*]/.test(t)) items.push(t.replace(/^[-•*]\s*/, ''))
      else paragraphs.push(t)
    }
    return {
      id: skeleton.id,
      paragraphs: paragraphs.length ? paragraphs : undefined,
      items: items.length ? items : undefined,
    }
  }

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!paragraphs.length) paragraphs.push(text)
  return { id: skeleton.id, paragraphs }
}

export function mergeSectionCopy(skeleton: DailySection, patch: SectionCopyPatch): DailySection {
  const next: DailySection = { ...skeleton }

  if (patch.paragraphs?.length) {
    next.paragraphs = patch.paragraphs.map((p, i) => assertParentFacingText(p, `${skeleton.id}.p${i}`))
  }
  if (patch.items?.length) {
    next.items = filterParentFacingList(patch.items, `${skeleton.id}.items`)
  }
  if (patch.quotes?.length) {
    next.quotes = patch.quotes.map((q, i) =>
      assertParentFacingText(q.replace(/^["「]|["」]$/g, ''), `${skeleton.id}.q${i}`)
    )
  }
  if (patch.note?.trim()) {
    next.note = assertParentFacingText(patch.note, `${skeleton.id}.note`)
  }

  return next
}

export type ParsedSectionStream = {
  sectionTexts: Map<string, string>
  /** 已有下一段 marker 或 stream 结束的 section id */
  completedIds: string[]
  taskTitle?: string
  startedIds: string[]
}

export function parseMarkerStream(full: string, skeletons: DailySection[], streamEnded = false): ParsedSectionStream {
  const taskIdx = full.indexOf(TASK_MARKER)
  const main = taskIdx >= 0 ? full.slice(0, taskIdx) : full
  const taskTitle = taskIdx >= 0 ? full.slice(taskIdx + TASK_MARKER.length).trim().slice(0, 48) : undefined

  const markers: { id: string; end: number; nextStart: number }[] = []
  SECTION_MARKER_RE.lastIndex = 0
  let match: RegExpExecArray | null
  const rawMarkers: { id: string; start: number; end: number }[] = []
  while ((match = SECTION_MARKER_RE.exec(main)) !== null) {
    rawMarkers.push({ id: match[1], start: match.index, end: match.index + match[0].length })
  }

  for (let i = 0; i < rawMarkers.length; i++) {
    const cur = rawMarkers[i]
    const nextStart = rawMarkers[i + 1]?.start ?? main.length
    markers.push({ id: cur.id, end: cur.end, nextStart })
  }

  const sectionTexts = new Map<string, string>()
  const completedIds: string[] = []
  const startedIds: string[] = []

  for (let i = 0; i < markers.length; i++) {
    const { id, end, nextStart } = markers[i]
    if (!skeletons.some((s) => s.id === id)) continue
    startedIds.push(id)
    const text = main.slice(end, nextStart)
    sectionTexts.set(id, text)
    const hasNext = i < markers.length - 1
    if (hasNext || taskIdx >= 0 || (streamEnded && i === markers.length - 1)) {
      completedIds.push(id)
    }
  }

  return { sectionTexts, completedIds, taskTitle: taskTitle || undefined, startedIds }
}

export type SectionStreamCallbacks = {
  onSectionStart?: (section: DailySection) => void
  onSectionDelta?: (id: string, text: string) => void
  onSectionComplete?: (section: DailySection) => void
}

export function createSectionStreamTracker(skeletons: DailySection[], callbacks: SectionStreamCallbacks) {
  let fullText = ''
  const started = new Set<string>()
  const completed = new Set<string>()
  const lastTexts = new Map<string, string>()

  function feed(delta: string) {
    fullText += delta
    const parsed = parseMarkerStream(fullText, skeletons, false)

    for (const id of parsed.startedIds) {
      if (started.has(id)) continue
      started.add(id)
      const sk = skeletons.find((s) => s.id === id)
      if (sk) callbacks.onSectionStart?.({ ...sk, streamingText: '' })
    }

    for (const [id, text] of parsed.sectionTexts) {
      if (lastTexts.get(id) === text) continue
      lastTexts.set(id, text)
      callbacks.onSectionDelta?.(id, text)
    }

    for (const id of parsed.completedIds) {
      if (completed.has(id)) continue
      completed.add(id)
      const sk = skeletons.find((s) => s.id === id)
      const raw = parsed.sectionTexts.get(id) || ''
      if (sk && raw.trim()) {
        callbacks.onSectionComplete?.(mergeSectionCopy(sk, rawTextToPatch(sk, raw)))
      }
    }
  }

  function finalize(): { sections: DailySection[]; taskTitle?: string } {
    const parsed = parseMarkerStream(fullText, skeletons, true)
    const sections: DailySection[] = []

    for (const sk of skeletons) {
      const raw = (parsed.sectionTexts.get(sk.id) || '').trim()
      if (!raw) {
        throw new Error(`PARENT_FACING_SECTION_MISSING:${sk.id}`)
      }
      sections.push(mergeSectionCopy(sk, rawTextToPatch(sk, raw)))
    }

    return { sections, taskTitle: parsed.taskTitle }
  }

  return { feed, finalize }
}

export function buildSectionStreamTask(skeletons: DailySection[]): string {
  const order = skeletons.map((s) => s.id).join(' → ')
  return `按顺序为 sectionSkeletons 生成家长可见正文。输出格式（严格，不要 JSON）：
每个 section 必须以单独一行标记开始：---section:{id}---
标记后只写该 section 正文（段落用空行分隔；列表项每行以 - 开头）。
全部 section 结束后，另起一行写 ---task---，下一行写 taskTitle（6-24 字祈使句，供「今晚任务」使用）。
顺序必须为：${order}
禁止输出 markdown 标题、编号列表外的 JSON、或任何解释性前后缀。`
}

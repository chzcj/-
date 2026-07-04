import type { DailySection } from '@/types/daily-message'

/** 流式阶段增量解析：按 \\n\\n 拆段落，- 开头行变列表项 */
export function parseStreamingSectionBody(
  text: string,
  kind: DailySection['kind'] = 'paragraphs'
): { paragraphs?: string[]; items?: string[]; quotes?: string[] } {
  const trimmed = text.trim()
  if (!trimmed) return {}

  if (kind === 'quotes') {
    const quotes = trimmed
      .split(/\n+/)
      .map((q) => q.replace(/^[「"']|[」"']$/g, '').trim())
      .filter(Boolean)
    return quotes.length ? { quotes } : { paragraphs: [trimmed] }
  }

  if (kind === 'list') {
    const items = trimmed
      .split(/\n+/)
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
    return items.length ? { items } : { paragraphs: [trimmed] }
  }

  if (kind === 'mixed') {
    const blocks = trimmed.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
    const paragraphs: string[] = []
    const items: string[] = []
    for (const block of blocks) {
      const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean)
      const listLines = lines.filter((l) => /^[-•*]/.test(l))
      if (listLines.length === lines.length && listLines.length > 0) {
        items.push(...listLines.map((l) => l.replace(/^[-•*]\s*/, '')))
      } else {
        paragraphs.push(block)
      }
    }
    if (items.length) return { paragraphs: paragraphs.length ? paragraphs : undefined, items }
    return { paragraphs: paragraphs.length ? paragraphs : [trimmed] }
  }

  const paragraphs = trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length <= 1 && kind === 'paragraphs') {
    const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean)
    const allList = lines.length > 1 && lines.every((l) => /^[-•*]/.test(l))
    if (allList) {
      return {
        items: lines.map((l) => l.replace(/^[-•*]\s*/, '')),
      }
    }
  }

  return { paragraphs: paragraphs.length ? paragraphs : [trimmed] }
}

import type { DailySection } from '@yujian/contracts'

/** 流式阶段增量解析（对齐 Web parseStreamingSection.ts） */
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
    const items: string[] = []
    const paragraphs: string[] = []
    for (const line of trimmed.split(/\n/)) {
      const t = line.trim()
      if (!t) continue
      if (/^[-•*]/.test(t)) items.push(t.replace(/^[-•*]\s*/, ''))
      else paragraphs.push(t)
    }
    return {
      paragraphs: paragraphs.length ? paragraphs : undefined,
      items: items.length ? items : undefined,
    }
  }

  const paragraphs = trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length <= 1 && kind === 'paragraphs') {
    const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean)
    const allList = lines.length > 1 && lines.every((l) => /^[-•*]/.test(l))
    if (allList) {
      return { items: lines.map((l) => l.replace(/^[-•*]\s*/, '')) }
    }
  }

  return { paragraphs: paragraphs.length ? paragraphs : [trimmed] }
}

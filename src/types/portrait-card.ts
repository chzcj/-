export type PortraitCardKey =
  | 'growth'
  | 'focus'
  | 'behavior'
  | 'interaction'
  | 'strategies'
  | 'hypotheses'

export type PortraitCardSection = {
  heading: string
  items: string[]
}

export type PortraitCardContent = {
  summary: string
  lead?: string
  sections?: PortraitCardSection[]
}

export type DailyPortraitCards = Partial<Record<PortraitCardKey, PortraitCardContent | string>>

const SUMMARY_MAX = 56
const THIN_PLACEHOLDER = /^(还在了解|暂无|继续交流|完成交流|记录、任务|交流积累)/

export function normalizeTextKey(text: string): string {
  return text.replace(/[\s，,。．.：:；;！!？?「」""''\-—]/g, '').toLowerCase()
}

/** 按归一化文本去重，保留首次出现顺序。 */
export function dedupeTextParts(parts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const key = normalizeTextKey(trimmed)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

export function truncateSummary(text: string, max = SUMMARY_MAX): string {
  const value = text.trim()
  if (!value) return ''
  if (value.length <= max) return value
  const slice = value.slice(0, max)
  const breakAt = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('；'),
    slice.lastIndexOf('，'),
    slice.lastIndexOf('、')
  )
  const cut = breakAt >= Math.floor(max * 0.55) ? slice.slice(0, breakAt + 1) : slice
  return `${cut.replace(/[，,。：:；;]$/, '')}…`
}

export function isThinPortraitText(text: string): boolean {
  const t = text.trim()
  return !t || THIN_PLACEHOLDER.test(t)
}

export function normalizePortraitCard(
  raw: PortraitCardContent | string | undefined
): PortraitCardContent | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || isThinPortraitText(trimmed)) return undefined
    return {
      summary: truncateSummary(trimmed),
      lead: trimmed.length > SUMMARY_MAX ? trimmed : undefined,
    }
  }
  const summary = raw.summary?.trim() || ''
  if (!summary && !raw.lead && !raw.sections?.length) return undefined
  return {
    summary: summary ? truncateSummary(summary) : truncateSummary(raw.lead || ''),
    lead: raw.lead?.trim() || undefined,
    sections: raw.sections?.length
      ? raw.sections
          .map((s) => ({
            heading: s.heading?.trim() || '',
            items: dedupeTextParts(s.items || []),
          }))
          .filter((s) => s.heading && s.items.length > 0)
      : undefined,
  }
}

export function portraitCardSummary(card: PortraitCardContent | string | undefined): string {
  const normalized = normalizePortraitCard(card)
  return normalized?.summary || ''
}

export function portraitCardLead(card: PortraitCardContent | string | undefined): string {
  const normalized = normalizePortraitCard(card)
  return normalized?.lead || normalized?.summary || ''
}

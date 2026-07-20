import 'server-only'

const MS_DAY = 86400000

/** 滚动窗口结束：今天 23:59:59.999（本地时区） */
export function getRollingWindowEnd(date = new Date()): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** 滚动窗口开始：含今天共 days 天，起始日 00:00:00 */
export function getRollingWindowStart(date = new Date(), days = 7): Date {
  const end = getRollingWindowEnd(date)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  return start
}

/** 幂等键：锚定窗口结束日 */
export function getRollingWindowKey(date = new Date()): string {
  const end = getRollingWindowEnd(date)
  const y = end.getFullYear()
  const m = String(end.getMonth() + 1).padStart(2, '0')
  const d = String(end.getDate()).padStart(2, '0')
  return `7d:${y}-${m}-${d}`
}

/** 上一段等长滚动窗口（时间胶囊 then） */
export function previousRollingWindowKey(windowKey: string): string {
  const m = windowKey.match(/^7d:(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return windowKey
  const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  end.setDate(end.getDate() - 7)
  return getRollingWindowKey(end)
}

export function isDateInRollingWindow(iso: string, ref = new Date(), days = 7): boolean {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  const start = getRollingWindowStart(ref, days).getTime()
  const end = getRollingWindowEnd(ref).getTime()
  return t >= start && t <= end
}

function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** UI：近7天 · 7月14日 – 7月20日 */
export function getRollingWindowRangeLabel(date = new Date(), days = 7): string {
  const start = getRollingWindowStart(date, days)
  const end = getRollingWindowEnd(date)
  return `近${days}天 · ${fmtShort(start)} – ${fmtShort(end)}`
}

/** 时间胶囊短标签：7月14日起 */
export function formatRollingWindowShort(windowKey: string): string {
  const m = windowKey.match(/^7d:(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return windowKey
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${d.getMonth() + 1}月${d.getDate()}日起`
}

/** 时间胶囊区间：7月14日–7月20日 */
export function formatRollingWindowRange(windowKey: string): string {
  const m = windowKey.match(/^7d:(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return windowKey
  const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  return `${fmtShort(start)}–${fmtShort(end)}`
}

export function rollingWindowStartEnd(windowKey: string): { start: Date; end: Date } {
  const m = windowKey.match(/^7d:(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) {
    const now = new Date()
    return { start: getRollingWindowStart(now), end: getRollingWindowEnd(now) }
  }
  const end = getRollingWindowEnd(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  const start = getRollingWindowStart(end)
  return { start, end }
}

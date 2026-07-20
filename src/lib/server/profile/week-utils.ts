import 'server-only'

/** ISO week key e.g. 2026-W29 */
export function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function getWeekRangeLabel(date = new Date()): string {
  const day = date.getDay()
  const mon = new Date(date)
  mon.setDate(date.getDate() - ((day + 6) % 7))
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`
  return `本周 · ${fmt(mon)} – ${fmt(sun)}`
}

export function getMonthLabel(date = new Date()): string {
  return `${date.getMonth() + 1}月`
}

export function isInWeek(iso: string, ref = new Date()): boolean {
  return getWeekKey(new Date(iso)) === getWeekKey(ref)
}

export function previousWeekKey(weekKey: string): string {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return weekKey
  const year = Number(m[1])
  const week = Number(m[2])
  if (week > 1) return `${year}-W${String(week - 1).padStart(2, '0')}`
  return `${year - 1}-W52`
}

export function weekStartEnd(weekKey: string): { start: Date; end: Date } {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/)
  const year = m ? Number(m[1]) : new Date().getFullYear()
  const week = m ? Number(m[2]) : 1
  const jan4 = new Date(year, 0, 4)
  const day = jan4.getDay() || 7
  const mon = new Date(jan4)
  mon.setDate(jan4.getDate() - day + 1 + (week - 1) * 7)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return { start: mon, end: sun }
}

export function isDateInWeekKey(iso: string, weekKey: string): boolean {
  const t = new Date(iso).getTime()
  const { start, end } = weekStartEnd(weekKey)
  return t >= start.getTime() && t <= end.getTime()
}

/** 手账/时间胶囊用：7月7日–7月13日 */
export function formatWeekKeyRange(weekKey: string): string {
  const { start, end } = weekStartEnd(weekKey)
  const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`
  return `${fmt(start)}–${fmt(end)}`
}

export function formatWeekKeyShort(weekKey: string): string {
  const { start } = weekStartEnd(weekKey)
  return `${start.getMonth() + 1}月${start.getDate()}日起`
}

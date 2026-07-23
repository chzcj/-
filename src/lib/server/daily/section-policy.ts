import type { DailySection } from '@/types/daily-message'

const PRIORITY_BY_ROUTE: Record<string, string[]> = {
  high: ['diagnosis_headline', 'history_thinking', 'advice', 'relief_signal'],
  low: ['directions', 'this_time'],
  risk: ['relief_signal', 'history_thinking', 'advice'],
}

export function routeKeyForSections(sections: DailySection[]): keyof typeof PRIORITY_BY_ROUTE {
  const ids = new Set(sections.map((s) => s.id))
  if (ids.has('relief_signal')) return 'risk'
  if (ids.has('directions')) return 'low'
  return 'high'
}

export function filterRecentSectionIds(sections: DailySection[], recentIds: string[]): DailySection[] {
  if (!recentIds.length) return sections
  const recent = new Set(recentIds)
  const filtered = sections.filter((s) => s.hidden || !recent.has(s.id))
  // 兜底：若去重后可见 section 全被剥光（长对话里同 id 反复出现时会这样），
  // 至少保留第一条可见 section，避免家长看到"只有正文+动作、没有要点卡"的空态。
  const hasVisible = filtered.some((s) => !s.hidden)
  if (!hasVisible) {
    const firstVisible = sections.find((s) => !s.hidden)
    if (firstVisible) {
      const withoutDup = filtered.filter((s) => s.id !== firstVisible.id)
      return [firstVisible, ...withoutDup]
    }
  }
  return filtered
}

export function limitVisibleSections(sections: DailySection[], maxVisible = 4): DailySection[] {
  const hidden = sections.filter((s) => s.hidden)
  const visible = sections.filter((s) => !s.hidden)
  if (visible.length <= maxVisible) return [...visible, ...hidden]

  const route = routeKeyForSections(sections)
  const priority = PRIORITY_BY_ROUTE[route]
  const picked: DailySection[] = []
  const used = new Set<string>()

  for (const id of priority) {
    const section = visible.find((s) => s.id === id)
    if (!section || used.has(id)) continue
    picked.push(section)
    used.add(id)
    if (picked.length >= maxVisible) break
  }

  for (const section of visible) {
    if (picked.length >= maxVisible) break
    if (used.has(section.id)) continue
    picked.push(section)
    used.add(section.id)
  }

  return [...picked, ...hidden]
}

export function applySectionPolicy(
  sections: DailySection[],
  recentSectionIds: string[] = [],
  maxVisible = 4
): DailySection[] {
  return limitVisibleSections(filterRecentSectionIds(sections, recentSectionIds), maxVisible)
}

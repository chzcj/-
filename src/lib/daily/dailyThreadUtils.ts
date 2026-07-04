import type { DailyTurn } from '@/lib/daily/dailyStreamClient'

/** 近 window 轮 AI 回复里已展示过的 section id（供 BFF 去重） */
export function collectRecentSectionIds(turns: DailyTurn[], window = 3): string[] {
  const ids = new Set<string>()
  const aiTurns = turns.filter((t) => t.role === 'ai').slice(-window)
  for (const turn of aiTurns) {
    for (const section of turn.sections || []) {
      if (!section.hidden) ids.add(section.id)
    }
  }
  return [...ids]
}

export const DAILY_DEEP_STORAGE_KEY = 'childos_daily_deep_sections'

export function stashDailyDeepSections(
  sections: DailyTurn['sections'],
  prose?: string,
  traceId?: string
) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      DAILY_DEEP_STORAGE_KEY,
      JSON.stringify({ sections: sections || [], prose: prose || '', traceId: traceId || '' })
    )
  } catch {
    /* ignore */
  }
}

export function readDailyDeepSections(): {
  sections: NonNullable<DailyTurn['sections']>
  prose: string
  traceId?: string
} {
  if (typeof window === 'undefined') return { sections: [], prose: '' }
  try {
    const raw = sessionStorage.getItem(DAILY_DEEP_STORAGE_KEY)
    if (!raw) return { sections: [], prose: '' }
    const parsed = JSON.parse(raw) as { sections?: DailyTurn['sections']; prose?: string; traceId?: string }
    return {
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      prose: parsed.prose || '',
      traceId: parsed.traceId || undefined,
    }
  } catch {
    return { sections: [], prose: '' }
  }
}

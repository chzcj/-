import type { DailyTurn } from '@/services/dailyStream'

/** 近 window 轮 AI 回复里已展示过的 section id（供 BFF 去重），对齐 Web dailyThreadUtils */
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

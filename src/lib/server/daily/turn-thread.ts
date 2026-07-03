import 'server-only'

import type { TurnEvent } from '@/types/database'
import type { DailyAction, DailySection } from '@/types/daily-message'
import type { DailyTurn } from '@/lib/daily/dailyStreamClient'

type TurnPack = {
  sections?: DailySection[]
  actions?: DailyAction[]
}

/** 将 turn_events 转为 daily 页面可渲染的 parent+ai 线程（每事件 = 1 轮）。
 *  仅包含 daily_dialogue 模式，排除预演/诊断等专项功能的 TurnEvent。 */
export function turnEventsToDailyThread(events: TurnEvent[], maxRounds = 15): DailyTurn[] {
  const dailyOnly = events.filter((e) => e.mode === 'daily_dialogue')
  const sorted = [...dailyOnly].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const recent = sorted.slice(-maxRounds)
  const turns: DailyTurn[] = []

  for (const event of recent) {
    const parentText = event.userMessage?.trim()
    if (!parentText) continue

    turns.push({ role: 'parent', text: parentText })

    const pack = event.specializedContextPackSnapshot as TurnPack | undefined
    const aiText = event.assistantReply?.trim()
    if (!aiText) continue

    turns.push({
      role: 'ai',
      text: aiText,
      traceId: event.traceId,
      linkedAreas: event.linkedAreas,
      sections: pack?.sections,
      actions: pack?.actions,
    })
  }

  return turns
}

import type { DailyCards } from '@/types/database'
import type { DailySection } from '@/types/daily-message'
import type { DailyComponentId } from '@/lib/daily/selectDailyComponents'

/** 历史轮次无 sections 时，从旧 DailyCards 降级渲染 */
export function composeLegacySectionsFromCards(cards?: DailyCards): DailySection[] {
  if (!cards) return []
  const sections: DailySection[] = []
  const active = (cards.activeComponents || []) as DailyComponentId[]

  for (const id of active) {
    switch (id) {
      case 'judgment_delta':
        if (cards.judgmentDelta) {
          sections.push({
            id: 'judgment_delta',
            label: '判断有更新',
            kind: 'paragraphs',
            paragraphs: [cards.judgmentDelta],
          })
        }
        break
      case 'evidence':
        if (cards.evidenceBasis) {
          sections.push({
            id: 'evidence',
            label: '判断依据',
            kind: 'paragraphs',
            paragraphs: [cards.evidenceBasis],
          })
        }
        break
      case 'deep_reading':
        if (cards.understandingCard?.reading) {
          sections.push({
            id: 'deep_reading',
            label: '结合孩子画像的分析',
            kind: 'paragraphs',
            paragraphs: [cards.understandingCard.reading],
          })
        }
        break
      case 'advice_hint':
        if (cards.adviceSeed) {
          sections.push({
            id: 'advice_hint',
            label: '你可以尝试改变的点',
            kind: 'paragraphs',
            paragraphs: [cards.adviceSeed],
          })
        }
        break
      default:
        break
    }
  }

  if (cards.sections?.length) return cards.sections
  return sections
}

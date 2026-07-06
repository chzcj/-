import 'server-only'

import type { DailyPortraitCards } from '@/lib/server/profile/daily-refresh-agent'
import type { DeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { isProfilePlaceholderText, stripProfilePlaceholder } from '@/lib/profile/placeholder-text'

export const MIN_PORTRAIT_CARD_CHARS = 120

const THIN_PLACEHOLDER = /^(还在了解|暂无|继续交流|完成交流|记录、任务|交流积累)/

function charLen(text: string): number {
  return text.replace(/\s/g, '').length
}

function joinParts(parts: string[], sep = ' '): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(sep).trim()
}

function pickFacts(pack: DeepModelDigestPack, max = 3): string {
  return pack.anchoredFacts.slice(0, max).join('；')
}

/** 单卡拼装：优先已有正文，不足 120 字则用 digest 机制叙事 + 锚定事实兜底。 */
export function enrichPortraitCardBody(
  key: keyof DailyPortraitCards,
  body: string | undefined,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): string {
  const trimmed = stripProfilePlaceholder(body)
  if (trimmed && charLen(trimmed) >= MIN_PORTRAIT_CARD_CHARS && !THIN_PLACEHOLDER.test(trimmed)) {
    return trimmed
  }

  const facts = pickFacts(pack)
  const narrative = pack.mechanismNarrative.trim()
  const core = stripProfilePlaceholder(extras?.coreJudgment) || ''
  const support = extras?.supportFocus?.trim() || pack.cultivationFocus.trim()

  const byKey: Record<keyof DailyPortraitCards, string> = {
    growth: joinParts([trimmed, narrative, facts, core], ' '),
    focus: joinParts([trimmed, support, pack.cultivationFocus, narrative.slice(0, 160)], ' '),
    behavior: joinParts([trimmed, facts, narrative, core.slice(0, 120)], ' '),
    interaction: joinParts([trimmed, pack.interactionLoops.join('；'), narrative.slice(0, 160)], ' '),
    strategies: joinParts([trimmed, pack.cultivationFocus, support, facts], ' '),
    hypotheses: joinParts([trimmed, pack.openHypotheses.join('；'), narrative.slice(0, 100)], ' '),
  }

  let enriched = byKey[key] || joinParts([trimmed, narrative, facts], ' ')
  if (charLen(enriched) < MIN_PORTRAIT_CARD_CHARS) {
    enriched = joinParts([enriched, narrative, facts, pack.openHypotheses[0] || ''], ' ')
  }
  if (charLen(enriched) < MIN_PORTRAIT_CARD_CHARS && core) {
    enriched = joinParts([enriched, core], ' ')
  }

  return enriched.trim() || trimmed || '继续交流后，这里会出现更完整的深度分析。'
}

export function enrichPortraitCards(
  cards: DailyPortraitCards | undefined,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): DailyPortraitCards {
  const keys: (keyof DailyPortraitCards)[] = [
    'growth',
    'focus',
    'behavior',
    'interaction',
    'strategies',
    'hypotheses',
  ]
  const out: DailyPortraitCards = { ...(cards || {}) }
  for (const key of keys) {
    out[key] = enrichPortraitCardBody(key, out[key], pack, extras)
  }
  return out
}

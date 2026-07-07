import 'server-only'

import type { DeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { stripProfilePlaceholder } from '@/lib/profile/placeholder-text'
import {
  dedupeTextParts,
  isThinPortraitText,
  normalizePortraitCard,
  truncateSummary,
  type DailyPortraitCards,
  type PortraitCardContent,
  type PortraitCardKey,
  type PortraitCardSection,
} from '@/types/portrait-card'

export type { DailyPortraitCards, PortraitCardContent, PortraitCardKey }

const CARD_KEYS: PortraitCardKey[] = [
  'growth',
  'focus',
  'behavior',
  'interaction',
  'strategies',
  'hypotheses',
]

function pickFacts(pack: DeepModelDigestPack, max = 3): string[] {
  return pack.anchoredFacts.slice(0, max)
}

function defaultSectionsForKey(
  key: PortraitCardKey,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): PortraitCardSection[] {
  const core = stripProfilePlaceholder(extras?.coreJudgment) || ''
  const support = extras?.supportFocus?.trim() || ''
  const narrative = pack.mechanismNarrative.trim()
  const facts = pickFacts(pack)
  const cultivation = pack.cultivationFocus.trim()

  const byKey: Record<PortraitCardKey, PortraitCardSection[]> = {
    growth: [
      {
        heading: '机制理解',
        items: dedupeTextParts([narrative, core].filter(Boolean)),
      },
      {
        heading: '已观察到的场景',
        items: facts.slice(0, 2),
      },
    ],
    focus: [
      {
        heading: '当前成长重点',
        items: dedupeTextParts([support, cultivation].filter(Boolean)),
      },
    ],
    behavior: [
      {
        heading: '行为模式',
        items: dedupeTextParts(facts),
      },
    ],
    interaction: [
      {
        heading: '家庭互动循环',
        items: dedupeTextParts(pack.interactionLoops),
      },
    ],
    strategies: [
      {
        heading: '可试一步',
        items: dedupeTextParts([cultivation, support].filter(Boolean)),
      },
    ],
    hypotheses: [
      {
        heading: '待验证判断',
        items: dedupeTextParts(pack.openHypotheses),
      },
    ],
  }

  return byKey[key].filter((s) => s.items.length > 0)
}

function defaultLeadForKey(
  key: PortraitCardKey,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): string {
  const core = stripProfilePlaceholder(extras?.coreJudgment) || ''
  const support = extras?.supportFocus?.trim() || ''
  const narrative = pack.mechanismNarrative.trim()

  const byKey: Record<PortraitCardKey, string> = {
    growth: core || narrative,
    focus: support || pack.cultivationFocus.trim(),
    behavior: pickFacts(pack, 1)[0] || core,
    interaction: pack.interactionLoops[0] || '',
    strategies: support || pack.cultivationFocus.trim(),
    hypotheses: pack.openHypotheses[0] || '',
  }

  return byKey[key]?.trim() || ''
}

function defaultSummaryForKey(
  key: PortraitCardKey,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): string {
  return truncateSummary(defaultLeadForKey(key, pack, extras))
}

/** 补全单卡缺失字段，不重复拼接同一句。 */
export function enrichPortraitCardContent(
  key: PortraitCardKey,
  raw: PortraitCardContent | string | undefined,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): PortraitCardContent {
  const normalized = normalizePortraitCard(raw)
  const leadFallback = defaultLeadForKey(key, pack, extras)
  const summaryFallback = defaultSummaryForKey(key, pack, extras)
  const sectionFallback = defaultSectionsForKey(key, pack, extras)

  const lead = normalized?.lead && !isThinPortraitText(normalized.lead)
    ? normalized.lead
    : leadFallback

  const summary = normalized?.summary && !isThinPortraitText(normalized.summary)
    ? normalized.summary
    : truncateSummary(lead || summaryFallback)

  const sections = normalized?.sections?.length ? normalized.sections : sectionFallback

  return {
    summary: summary || '继续交流后，这里会出现更完整的深度分析。',
    lead: lead || undefined,
    sections: sections.length ? sections : undefined,
  }
}

export function enrichPortraitCards(
  cards: DailyPortraitCards | undefined,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): DailyPortraitCards {
  const out: DailyPortraitCards = {}
  for (const key of CARD_KEYS) {
    out[key] = enrichPortraitCardContent(key, cards?.[key], pack, extras)
  }
  return out
}

/** @deprecated 使用 enrichPortraitCardContent + buildPortraitCardDetail */
export function enrichPortraitCardBody(
  key: PortraitCardKey,
  body: string | undefined,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): string {
  const card = enrichPortraitCardContent(key, body, pack, extras)
  const parts = dedupeTextParts([
    card.lead || card.summary,
    ...(card.sections || []).flatMap((s) => s.items),
  ])
  return parts.join('\n\n') || card.summary
}

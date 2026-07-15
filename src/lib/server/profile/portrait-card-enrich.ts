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
  'tensions',
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
        heading: '目前怎么看',
        items: dedupeTextParts([core, narrative].filter(Boolean)).slice(0, 2),
      },
      {
        heading: '你说过的事',
        items: facts.slice(0, 2),
      },
    ],
    focus: [
      {
        heading: '眼下可以盯住的一点',
        items: dedupeTextParts([support, cultivation].filter(Boolean)),
      },
    ],
    behavior: [
      {
        heading: '常见反应',
        items: dedupeTextParts(facts),
      },
    ],
    interaction: [
      {
        heading: '家里怎么绕进去的',
        items: dedupeTextParts(pack.interactionLoops),
      },
    ],
    strategies: [
      {
        heading: '可以先试的一小步',
        items: dedupeTextParts([cultivation, support].filter(Boolean)),
      },
    ],
    hypotheses: [
      {
        heading: '写作业时常见卡点',
        items: dedupeTextParts(pack.openHypotheses),
      },
    ],
    tensions: [
      {
        heading: '家里容易绕进去的地方',
        items: dedupeTextParts(pack.structuralTensions).slice(0, 4),
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
    tensions: pack.structuralTensions[0] || pack.interactionLoops[0] || '',
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

type EnrichExtras = {
  coreJudgment?: string
  supportFocus?: string
  /** LLM 已出人话时只补空，不用 digest 盖写 */
  preferLlm?: boolean
}

/** 补全单卡缺失字段；preferLlm 时尊重 Agent 原文。 */
export function enrichPortraitCardContent(
  key: PortraitCardKey,
  raw: PortraitCardContent | string | undefined,
  pack: DeepModelDigestPack,
  extras?: EnrichExtras
): PortraitCardContent {
  const normalized = normalizePortraitCard(raw)
  const preferLlm = Boolean(extras?.preferLlm)
  const leadFallback = defaultLeadForKey(key, pack, extras)
  const summaryFallback = defaultSummaryForKey(key, pack, extras)
  const sectionFallback = defaultSectionsForKey(key, pack, extras)

  const hasLlmLead = Boolean(normalized?.lead && !isThinPortraitText(normalized.lead))
  const hasLlmSummary = Boolean(normalized?.summary && !isThinPortraitText(normalized.summary))
  const hasLlmSections = Boolean(normalized?.sections?.length)

  if (preferLlm && (hasLlmLead || hasLlmSummary || hasLlmSections)) {
    return {
      summary:
        (hasLlmSummary ? normalized!.summary : truncateSummary(normalized?.lead || summaryFallback)) ||
        '还在了解',
      lead: hasLlmLead ? normalized!.lead : normalized?.lead || undefined,
      sections: hasLlmSections ? normalized!.sections : undefined,
    }
  }

  const lead = hasLlmLead ? normalized!.lead! : leadFallback
  const summary = hasLlmSummary
    ? normalized!.summary!
    : truncateSummary(lead || summaryFallback)
  const sections = hasLlmSections ? normalized!.sections! : sectionFallback

  return {
    summary: summary || '继续交流后，这里会出现更完整的深度分析。',
    lead: lead || undefined,
    sections: sections.length ? sections : undefined,
  }
}

export function enrichPortraitCards(
  cards: DailyPortraitCards | undefined,
  pack: DeepModelDigestPack,
  extras?: EnrichExtras
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

import 'server-only'

import type { DeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import {
  dedupeTextParts,
  normalizeTextKey,
  type PortraitCardContent,
  type PortraitCardKey,
  type PortraitCardSection,
} from '@/types/portrait-card'

export type PortraitCardDetail = {
  summary: string
  lead?: string
  sections: PortraitCardSection[]
  anchoredFacts: string[]
}

function collectKnownText(card: PortraitCardContent): Set<string> {
  const keys = new Set<string>()
  for (const text of [card.summary, card.lead]) {
    if (text?.trim()) keys.add(normalizeTextKey(text))
  }
  for (const section of card.sections || []) {
    for (const item of section.items) {
      keys.add(normalizeTextKey(item))
    }
  }
  return keys
}

function factOverlapsKnown(fact: string, known: Set<string>): boolean {
  const key = normalizeTextKey(fact)
  if (!key) return true
  if (known.has(key)) return true
  for (const k of known) {
    if (k.length >= 12 && (key.includes(k) || k.includes(key))) return true
  }
  return false
}

export function buildPortraitCardDetail(
  key: PortraitCardKey,
  card: PortraitCardContent,
  pack: DeepModelDigestPack
): PortraitCardDetail {
  const known = collectKnownText(card)
  const anchoredFacts = dedupeTextParts(pack.anchoredFacts).filter(
    (f) => !factOverlapsKnown(f, known)
  )

  const sections = (card.sections || []).map((s) => ({
    heading: s.heading,
    items: dedupeTextParts(s.items),
  }))

  if (key === 'behavior' && anchoredFacts.length > 0 && !sections.some((s) => s.heading.includes('事实'))) {
    sections.push({
      heading: '依据事实',
      items: anchoredFacts.slice(0, 4),
    })
    return {
      summary: card.summary,
      lead: card.lead,
      sections,
      anchoredFacts: [],
    }
  }

  return {
    summary: card.summary,
    lead: card.lead,
    sections,
    anchoredFacts: anchoredFacts.slice(0, 6),
  }
}

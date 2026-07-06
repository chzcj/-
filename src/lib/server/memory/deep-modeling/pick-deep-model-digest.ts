import type { DeepModelDigest } from '@/types/deep-model-digest'
import { EMPTY_DEEP_MODEL_DIGEST } from '@/types/deep-model-digest'

/** 供前台 Agent user payload 注入的 digest 形状（全 string / string[]，禁止结构化对象泄漏）。 */
export type DeepModelDigestPack = {
  mechanismNarrative: string
  interactionLoops: string[]
  anchoredFacts: string[]
  parentVerbatimSnippets: string[]
  childQuotes: string[]
  parentInteractionStyle: string
  preferredPacing: string
  openHypotheses: string[]
  cultivationFocus: string
}

const SLICE = {
  interactionLoops: 4,
  anchoredFacts: 8,
  parentVerbatimSnippets: 5,
  childQuotes: 4,
  openHypotheses: 5,
} as const

export function pickDeepModelDigestPack(digest: DeepModelDigest | null | undefined): DeepModelDigestPack {
  const d = digest ?? EMPTY_DEEP_MODEL_DIGEST
  return {
    mechanismNarrative: d.mechanismNarrative?.trim() || '',
    interactionLoops: (d.interactionLoops || []).slice(0, SLICE.interactionLoops),
    anchoredFacts: (d.anchoredFacts || []).slice(0, SLICE.anchoredFacts),
    parentVerbatimSnippets: (d.parentVerbatimSnippets || []).slice(0, SLICE.parentVerbatimSnippets),
    childQuotes: (d.childQuotes || []).slice(0, SLICE.childQuotes),
    parentInteractionStyle: d.parentInteractionStyle?.trim() || '',
    preferredPacing: d.preferredPacing?.trim() || '',
    openHypotheses: (d.openHypotheses || []).slice(0, SLICE.openHypotheses),
    cultivationFocus: d.cultivationFocus?.trim() || '',
  }
}

export function deepModelDigestHasContent(pack: DeepModelDigestPack): boolean {
  return Boolean(
    pack.mechanismNarrative ||
      pack.anchoredFacts.length > 0 ||
      pack.interactionLoops.length > 0 ||
      pack.openHypotheses.length > 0
  )
}

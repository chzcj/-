import 'server-only'

import { callFastJson } from '@/lib/server/ark-agents'
import { promptRegistry } from '@/lib/server/prompts/registry.generated'
import type { DeepModelDigest } from '@/types/deep-model-digest'
import type { TenantId } from '@/lib/server/memory/tenant'
import {
  getLatestBuiltProfileSnapshot,
  getMergedParentInputHistory,
  getLatestEvidenceNetwork,
} from '@/lib/server/memory/database-manager'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => asString(v)).filter(Boolean)
}

function charLen(text: string): number {
  return text.replace(/\s/g, '').length
}

/** 在确定性 digest 之上调用 LLM 加深机制叙事；失败或太薄则返回 undefined。 */
export async function buildLlmDeepModelDigest(
  tenant: TenantId,
  base: DeepModelDigest
): Promise<DeepModelDigest | undefined> {
  const [built, network, history] = await Promise.all([
    getLatestBuiltProfileSnapshot(tenant).catch(() => null),
    getLatestEvidenceNetwork(tenant).catch(() => null),
    getMergedParentInputHistory(tenant, 8).catch(() => []),
  ])

  const topMechanisms =
    network?.candidateMechanismMatrix
      ?.filter((m) => m.mechanismName)
      .slice(0, 3)
      .map((m) => `${m.mechanismName}：${m.description || ''}`.trim()) || []

  const payload = {
    deterministicBase: {
      mechanismNarrative: base.mechanismNarrative,
      interactionLoops: base.interactionLoops,
      anchoredFacts: base.anchoredFacts,
      openHypotheses: base.openHypotheses,
      cultivationFocus: base.cultivationFocus,
    },
    coreJudgment: built?.coreJudgment || '',
    supportFocus: built?.supportFocus || '',
    topMechanisms,
    recentParentInputs: history.map((h) => h.text).filter(Boolean).slice(0, 5),
  }

  const raw = await callFastJson<Record<string, unknown>>(
    promptRegistry.deepModelDigestBuilder,
    payload,
    { maxTokens: 1400 }
  ).catch(() => undefined)

  if (!raw) return undefined

  const mechanismNarrative = asString(raw.mechanismNarrative) || base.mechanismNarrative
  if (charLen(mechanismNarrative) < 120) return undefined

  return {
    mechanismNarrative,
    interactionLoops: asStringArray(raw.interactionLoops).length
      ? asStringArray(raw.interactionLoops).slice(0, 4)
      : base.interactionLoops,
    anchoredFacts: asStringArray(raw.anchoredFacts).length
      ? asStringArray(raw.anchoredFacts).slice(0, 8)
      : base.anchoredFacts,
    parentVerbatimSnippets: asStringArray(raw.parentVerbatimSnippets).length
      ? asStringArray(raw.parentVerbatimSnippets).slice(0, 5)
      : base.parentVerbatimSnippets,
    childQuotes: asStringArray(raw.childQuotes).length
      ? asStringArray(raw.childQuotes).slice(0, 4)
      : base.childQuotes,
    parentInteractionStyle: asString(raw.parentInteractionStyle) || base.parentInteractionStyle,
    preferredPacing: asString(raw.preferredPacing) || base.preferredPacing,
    openHypotheses: asStringArray(raw.openHypotheses).length
      ? asStringArray(raw.openHypotheses).slice(0, 5)
      : base.openHypotheses,
    cultivationFocus: asString(raw.cultivationFocus) || base.cultivationFocus,
    structuralTensions: base.structuralTensions,
    updatedAt: new Date().toISOString(),
    source: 'llm',
  }
}

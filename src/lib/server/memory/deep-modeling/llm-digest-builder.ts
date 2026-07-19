import 'server-only'

import { callFastJson } from '@/lib/server/ark-agents'
import { resolveAgentSystem } from '@/lib/server/prompts/modeling-identity'
import type { DeepModelDigest } from '@/types/deep-model-digest'
import type { TenantId } from '@/lib/server/memory/tenant'
import {
  getLatestBuiltProfileSnapshot,
  getMergedParentInputHistory,
  getLatestEvidenceNetwork,
  getChildBasicInfo,
} from '@/lib/server/memory/database-manager'
import { loadHighValueAtoms } from '@/lib/server/db'
import { getDeepModelDigestSlices } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { isPortraitV3Enabled } from '@/lib/server/memory/dossier/portrait-v3-flags'
import { getLatestDossier } from '@/lib/server/memory/deep-modeling/digest-store'

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
  const [built, network, history, highValueAtoms, childBasic] = await Promise.all([
    getLatestBuiltProfileSnapshot(tenant).catch(() => null),
    getLatestEvidenceNetwork(tenant).catch(() => null),
    getMergedParentInputHistory(tenant, 8).catch(() => []),
    loadHighValueAtoms(tenant.familyId, tenant.childId, 12).catch(() => []),
    getChildBasicInfo(tenant).catch(() => null),
  ])

  const topMechanisms =
    network?.candidateMechanismMatrix
      ?.filter((m) => m.mechanismName && m.overallStrength !== 'low')
      .slice(0, 16)
      .map((m) => `${m.mechanismName}：${m.description || ''}`.trim()) || []

  // 孩子真实话语样本（child_quote 高价值原子）：此前 payload 只有家长原话，
  // LLM 被要求输出 childQuotes 却没有孩子话语输入，导致该字段结构性为空。
  const childQuoteSamples = highValueAtoms
    .filter((a) => a.sourceType === 'child_quote' && a.content?.trim())
    .slice(0, 6)
    .map((a) => a.content.trim())

  const dossier =
    base.dossier ||
    (isPortraitV3Enabled() ? await getLatestDossier(tenant).catch(() => null) : null)
  const dossierProjection = dossier
    ? {
        integratedSynthesis: dossier.integratedSynthesis?.trim() || '',
        workingHypothesis: dossier.workingHypothesis?.text?.trim() || '',
        interventionTargets: dossier.interventionTargets
          .slice(0, 3)
          .map((t) => t.action)
          .filter(Boolean),
        sceneReadings: dossier.sceneReadings
          .slice(0, 3)
          .map((s) => `${s.scene}：${s.reading}`),
      }
    : undefined

  const payload = {
    deterministicBase: {
      mechanismNarrative: base.mechanismNarrative,
      interactionLoops: base.interactionLoops,
      anchoredFacts: base.anchoredFacts,
      openHypotheses: base.openHypotheses,
      cultivationFocus: base.cultivationFocus,
    },
    dossierProjection,
    coreJudgment: built?.coreJudgment || '',
    supportFocus: built?.supportFocus || '',
    topMechanisms,
    recentParentInputs: history.map((h) => h.text).filter(Boolean).slice(0, 5),
    childQuoteSamples,
    childBasic: childBasic
      ? [childBasic.age ? `${childBasic.age}岁` : '', childBasic.grade || ''].filter(Boolean).join('，')
      : '',
  }

  const raw = await callFastJson<Record<string, unknown>>(
    resolveAgentSystem('deepModelDigestBuilder'),
    payload,
    { maxTokens: 2500 }
  ).catch(() => undefined)

  if (!raw) return undefined

  const slice = getDeepModelDigestSlices()
  const mechanismNarrative = asString(raw.mechanismNarrative) || base.mechanismNarrative
  if (charLen(mechanismNarrative) < 120) return undefined

  return {
    mechanismNarrative,
    interactionLoops: asStringArray(raw.interactionLoops).length
      ? asStringArray(raw.interactionLoops).slice(0, slice.interactionLoops)
      : base.interactionLoops,
    anchoredFacts: asStringArray(raw.anchoredFacts).length
      ? asStringArray(raw.anchoredFacts).slice(0, slice.anchoredFacts)
      : base.anchoredFacts,
    parentVerbatimSnippets: asStringArray(raw.parentVerbatimSnippets).length
      ? asStringArray(raw.parentVerbatimSnippets).slice(0, slice.parentVerbatimSnippets)
      : base.parentVerbatimSnippets,
    childQuotes: asStringArray(raw.childQuotes).length
      ? asStringArray(raw.childQuotes).slice(0, slice.childQuotes)
      : base.childQuotes,
    parentInteractionStyle: asString(raw.parentInteractionStyle) || base.parentInteractionStyle,
    preferredPacing: asString(raw.preferredPacing) || base.preferredPacing,
    openHypotheses: asStringArray(raw.openHypotheses).length
      ? asStringArray(raw.openHypotheses).slice(0, slice.openHypotheses)
      : base.openHypotheses,
    cultivationFocus: asString(raw.cultivationFocus) || base.cultivationFocus,
    structuralTensions: base.structuralTensions,
    updatedAt: new Date().toISOString(),
    source: 'llm',
  }
}

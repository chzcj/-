import 'server-only'

import {
  getFamilyInteractionCycles,
  getLatestBuiltProfileSnapshot,
  getLatestEvidenceNetwork,
  getMergedParentInputHistory,
  getPendingHypotheses,
  getParentNarrativePattern,
} from '@/lib/server/memory/database-manager'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { DeepModelDigest, StructuralTension } from '@/types/deep-model-digest'
import { saveDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildLlmDeepModelDigest } from '@/lib/server/memory/deep-modeling/llm-digest-builder'
import { loadDeepMechanismHandoff } from '@/lib/server/memory/deep-mechanism/handoff-store'

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).replace(/[，,。：:；;]$/, '')}…`
}

/** 从记忆层确定性拼装家长向深度建模摘要（不调用 LLM，供前台必读门控）。 */
export async function buildDeepModelDigest(
  tenant: TenantId,
  structuralTensionsOverride?: StructuralTension[]
): Promise<DeepModelDigest> {
  const [built, network, cycles, hypotheses, history, narratives, handoff] = await Promise.all([
    getLatestBuiltProfileSnapshot(tenant).catch(() => null),
    getLatestEvidenceNetwork(tenant).catch(() => null),
    getFamilyInteractionCycles(tenant).catch(() => []),
    getPendingHypotheses(tenant).catch(() => []),
    getMergedParentInputHistory(tenant, 12).catch(() => []),
    getParentNarrativePattern(tenant).catch(() => null),
    loadDeepMechanismHandoff(tenant).catch(() => null),
  ])

  const topMechanism = network?.candidateMechanismMatrix?.find((m) => m.overallStrength !== 'low')
  const mechanismNarrative =
    topMechanism?.description?.trim() ||
    built?.deepMechanism?.trim() ||
    built?.coreJudgment?.trim() ||
    ''

  const interactionLoops = cycles.slice(0, 4).map((c) => {
    const parts = [
      c.parentTriggerAction,
      c.childReception,
      c.childReaction,
      c.parentSecondInterpretation,
    ].filter(Boolean)
    return truncate(parts.join(' → '), 160)
  }).filter(Boolean)

  const anchoredFacts: string[] = []
  for (const m of network?.candidateMechanismMatrix?.slice(0, 3) || []) {
    for (const f of m.supportingEvidence || []) {
      if (f?.trim()) anchoredFacts.push(truncate(f, 120))
    }
  }
  for (const ev of built?.evidence?.slice(0, 4) || []) {
    if (ev.evidenceText?.trim()) anchoredFacts.push(truncate(ev.evidenceText, 120))
  }
  const uniqueFacts = [...new Set(anchoredFacts)].slice(0, 8)

  const parentVerbatimSnippets = history
    .map((h) => h.text?.trim())
    .filter((t): t is string => Boolean(t && t.length >= 8))
    .slice(0, 5)
    .map((t) => truncate(t, 100))

  const childQuotes: string[] = []
  for (const m of network?.candidateMechanismMatrix || []) {
    for (const b of m.explainedBehaviors || []) {
      if (b?.includes('「') || b?.includes('"')) childQuotes.push(truncate(b, 80))
    }
  }

  const narrative = narratives
  const parentInteractionStyle =
    narrative?.interactionImplications?.[0] ||
    (narrative?.correctionReceptivity === 'low' ? '家长此刻更需要先被接住，再细问' : undefined)

  const preferredPacing =
    narrative?.factProvisionAbility === 'low'
      ? '短句、一次只问一个现场'
      : '可先共情再给一句可试的方向'

  const openHypotheses = hypotheses
    .filter((h) => h.status === 'pending' || h.status === 'supported')
    .slice(0, 5)
    .map((h) => truncate(h.hypothesis, 100))

  const cultivationFocus =
    built?.supportFocus?.trim() ||
    (topMechanism?.possibleProtectiveFunction
      ? `在理解「${truncate(topMechanism.possibleProtectiveFunction, 40)}」的基础上，找一个小场景试不同回应`
      : '从一个小场景开始，让孩子感到被看见，再谈学习节奏')

  const structuralTensions =
    structuralTensionsOverride?.length
      ? structuralTensionsOverride
      : handoff?.structuralTensions?.length
        ? handoff.structuralTensions
        : []

  const deterministic: DeepModelDigest = {
    mechanismNarrative: truncate(mechanismNarrative, 400),
    interactionLoops,
    anchoredFacts: uniqueFacts,
    parentVerbatimSnippets,
    childQuotes: [...new Set(childQuotes)].slice(0, 4),
    parentInteractionStyle,
    preferredPacing,
    openHypotheses,
    cultivationFocus: truncate(cultivationFocus, 200),
    structuralTensions,
    updatedAt: new Date().toISOString(),
    source: 'deterministic',
  }

  const llmDigest = await buildLlmDeepModelDigest(tenant, deterministic).catch(() => undefined)
  const digest: DeepModelDigest = {
    ...(llmDigest || deterministic),
    structuralTensions: llmDigest?.structuralTensions?.length
      ? llmDigest.structuralTensions
      : structuralTensions,
  }

  await saveDeepModelDigest(digest, tenant).catch((err) => {
    console.error('[deep-model-digest] 写入失败:', err)
  })

  return digest
}

import 'server-only'
import { callAgentJson } from '@/lib/server/ark-agents'
import { buildEntryPack, LEGACY_TO_NEW } from '@/lib/server/memory/entry-builder'
import { buildMemoryWritePlan, executeWritePlan } from '@/lib/server/memory/write/decision-engine'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { EntryEvidencePack, EvidenceStrength } from '@/types/database'

/* ================================================================
   后台「入口证据建造 Agent」（测评反馈：前台只返阶段反馈，证据包由后台深度生成）。
   消费 入口原话 + 前台粗总结 → LLM 深度拆解为高质量 EntryEvidencePack(L3) → 写库。
   LLM 不可用/抽取失败 → 回退规则版 buildEntryPack，保证 L3 仍落库（不退化）。
   由 entry_evidence job 调用；不吞异常（异常上抛驱动重试）。
   ================================================================ */

export interface EntryEvidencePayload {
  entryType: string
  rawText: string
  frontSummary?: string
  facts?: string[]
  hypotheses?: string[]
  tenant: TenantId
}

interface AiEntryEvidence {
  decomposedInput?: {
    verifiableFacts?: string[]
    childBehaviors?: string[]
    childQuotes?: string[]
    parentQuotes?: string[]
    parentActions?: string[]
    triggerPoints?: string[]
    parentEvaluations?: string[]
    parentAssumptions?: string[]
    parentGoals?: string[]
    missingInformation?: string[]
  }
  candidateMechanisms?: Array<{
    mechanismName?: string
    description?: string
    supportingEvidence?: string[]
    evidenceStrength?: string
    possibleProtectiveFunction?: string
    needsCrossEntryVerification?: boolean
  }>
  handoff?: {
    mostImportantEvidence?: string[]
    mostLikelyLocalMechanisms?: string[]
    mostImportantGaps?: string[]
    warnings?: string[]
  }
  confidence?: string
}

const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()) : []
const strength = (v: unknown): EvidenceStrength => (v === 'high' || v === 'low') ? v : 'medium'

// 深度拆解结果是否够实（否则回退规则版）：要有可验证事实或候选机制。
function isSubstantive(ai: AiEntryEvidence | undefined): boolean {
  if (!ai) return false
  const d = ai.decomposedInput
  const hasFacts = arr(d?.verifiableFacts).length > 0 || arr(d?.childBehaviors).length > 0
  const hasMech = Array.isArray(ai.candidateMechanisms) && ai.candidateMechanisms.some(m => typeof m?.mechanismName === 'string' && m.mechanismName.trim())
  return hasFacts || hasMech
}

function assemblePack(ai: AiEntryEvidence, payload: EntryEvidencePayload): EntryEvidencePack {
  const { entryType, rawText, tenant } = payload
  const now = new Date().toISOString()
  const d = ai.decomposedInput || {}
  const conf = ai.confidence === 'high' || ai.confidence === 'low' ? ai.confidence : 'medium'
  return {
    packId: `pack-evd-${tenant.familyId}-${entryType}`,
    familyId: tenant.familyId,
    childId: tenant.childId,
    entryName: LEGACY_TO_NEW[entryType] || 'learning_homework',
    entryStatus: 'evidence_pack_ready',
    rawInputSummary: payload.frontSummary ? `${payload.frontSummary} 原始描述：${rawText}` : rawText,
    decomposedInput: {
      verifiableFacts: arr(d.verifiableFacts).length > 0 ? arr(d.verifiableFacts) : (payload.facts || [rawText]),
      childBehaviors: arr(d.childBehaviors),
      parentActions: arr(d.parentActions),
      triggerPoints: arr(d.triggerPoints),
      parentEvaluations: arr(d.parentEvaluations),
      parentGoals: arr(d.parentGoals),
      missingInformation: arr(d.missingInformation).length > 0 ? arr(d.missingInformation) : (payload.hypotheses || []),
    },
    candidateMechanisms: (ai.candidateMechanisms || [])
      .filter(m => typeof m?.mechanismName === 'string' && m.mechanismName.trim())
      .slice(0, 4)
      .map(m => ({
        mechanismName: m.mechanismName!.trim(),
        description: typeof m.description === 'string' ? m.description : m.mechanismName!.trim(),
        supportingEvidence: arr(m.supportingEvidence),
        evidenceStrength: strength(m.evidenceStrength),
        counterEvidenceOrGap: [],
        needsCrossEntryVerification: m.needsCrossEntryVerification !== false,
        possibleProtectiveFunction: typeof m.possibleProtectiveFunction === 'string' ? m.possibleProtectiveFunction : '',
        doNotPromoteToStableProfileYet: true,
      })),
    evidenceUnits: [],
    followupCandidates: [],
    crossEntrySignals: [],
    handoffToSummaryAgent: {
      mostImportantEvidence: arr(ai.handoff?.mostImportantEvidence).length > 0 ? arr(ai.handoff?.mostImportantEvidence) : (payload.facts || [rawText]),
      mostLikelyLocalMechanisms: arr(ai.handoff?.mostLikelyLocalMechanisms),
      mostImportantGaps: arr(ai.handoff?.mostImportantGaps).length > 0 ? arr(ai.handoff?.mostImportantGaps) : (payload.hypotheses || []),
      possibleLinksToOtherEntries: [],
      warnings: [...arr(ai.handoff?.warnings), `confidence:${conf}`],
    },
    alreadyAskedQuestions: [],
    createdAt: now,
    updatedAt: now,
  }
}

export async function runEntryEvidenceBuild(payload: EntryEvidencePayload): Promise<void> {
  if (!payload.rawText?.trim() || !payload.entryType) return // 合法 no-op

  const ai = await callAgentJson<AiEntryEvidence>(
    'entryEvidenceBuilder',
    '把这段入口原话深度拆解成结构化入口证据包。事实与家长评价分开，机制是候选假设需标强度。',
    { entryType: payload.entryType, rawText: payload.rawText, frontSummary: payload.frontSummary || '', facts: payload.facts || [] }
  )

  // 深度拆解够实 → 用 LLM 包；否则回退规则版（保证 L3 不退化）。
  const pack: EntryEvidencePack = isSubstantive(ai)
    ? assemblePack(ai!, payload)
    : buildEntryPack(payload.entryType, {
        rawTexts: [payload.rawText],
        stageSummary: payload.frontSummary,
        followUps: [],
        aiFacts: payload.facts || [],
        aiHypotheses: payload.hypotheses || [],
      }, payload.tenant.familyId, payload.tenant.childId, 0)

  const plan = buildMemoryWritePlan({
    tenant: payload.tenant,
    entryEvidencePacks: [pack],
    rationale: {
      whyUpdate: `${payload.entryType} 入口证据包（后台深度拆解）`,
      whyNotPromoteSomeItems: '单入口证据，待跨入口综合再升级',
      riskOfOvergeneralization: '',
      nextVerificationNeed: pack.decomposedInput.missingInformation.join('；'),
    },
  })
  await executeWritePlan(plan, payload.tenant) // 不吞异常：异常上抛驱动 job 重试
}

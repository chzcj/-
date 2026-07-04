import 'server-only'

import { callAgentJson } from '@/lib/server/ark-agents'
import {
  getEntryEvidencePacks,
  getMergedParentInputHistory,
  getDailyInteractionUpdates,
  getLatestEvidenceNetwork,
  getPendingHypotheses,
  getLatestBuiltProfileSnapshot,
  saveBuiltProfileSnapshot,
  getFamilyInteractionCycles,
  getParentNarrativePattern,
  saveEvidenceNetwork,
  savePendingHypotheses,
  saveParentNarrativePattern,
} from '@/lib/server/memory/database-manager'
import { getCurrentMaturityState } from '@/lib/server/context/maturity'
import { createId } from '@/lib/storage/storageIds'
import type { TenantId } from '@/lib/server/memory/tenant'
import type {
  CandidateMechanism,
  CrossEntryEvidenceNetwork,
  EntryName,
  EvidenceStrength,
  FamilyInteractionChain,
  HypothesisWeight,
  MechanismType,
  ParentNarrativePattern,
  PendingHypothesis,
} from '@/types/database'

/* ================================================================
   深度机制复核 Agent（deep_mechanism_review）
   读全量家庭记忆 → 用五大生态系统+16家庭理论框架 → 产出回归家庭结构根因的
   candidateMechanismMatrix，覆盖 evidence_networks；同时产出 pending_hypotheses
   与 parent_narrative_patterns（修复 dead write）。
   由 deep_mechanism_review job 触发（四模块完成立即 + 每日桶 + 登录 forceCheck）。
   不吞异常：异常上抛驱动 job 重试。
   ================================================================ */

const ENTRY_NAMES: EntryName[] = [
  'learning_homework',
  'daily_rhythm_phone',
  'parent_child_communication',
  'emotional_stress',
  'relationship_environment',
]

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) : []

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback)

function normStrength(v: unknown): EvidenceStrength {
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'medium'
}

function normWeight(v: unknown): HypothesisWeight {
  const allowed: HypothesisWeight[] = ['very_low', 'low', 'medium', 'medium_high', 'high']
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as HypothesisWeight) : 'low'
}

function normTendency(v: unknown): 'frequent' | 'occasional' | 'rare' {
  return v === 'frequent' || v === 'occasional' || v === 'rare' ? v : 'occasional'
}

function normReceptivity(v: unknown): 'high' | 'medium' | 'low' {
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'medium'
}

/** LLM 的 overallStrength → 严格 MechanismType（理论卡名只存进 description，不进 mechanismType 枚举） */
function strengthToType(s: EvidenceStrength): MechanismType {
  if (s === 'high') return 'core_candidate'
  if (s === 'medium') return 'stage_candidate'
  return 'local_candidate'
}

/** LLM 输出 familyInteractionChain 可能是字符串（用 → 分隔）或对象；统一规整为 8 字段 */
function normChain(v: unknown): FamilyInteractionChain {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    return {
      parentTriggerAction: str(o.parentTriggerAction),
      parentReasonableGoal: str(o.parentReasonableGoal, '帮助孩子'),
      childReception: str(o.childReception),
      childReaction: str(o.childReaction),
      parentSecondInterpretation: str(o.parentSecondInterpretation),
      parentReinforcementAction: str(o.parentReinforcementAction),
      childFurtherStrategy: str(o.childFurtherStrategy),
      longTermEffect: str(o.longTermEffect),
    }
  }
  const text = str(v)
  const parts = text.split(/[→>]/).map((p) => p.trim()).filter(Boolean)
  return {
    parentTriggerAction: parts[0] || '',
    parentReasonableGoal: '帮助孩子',
    childReception: parts[1] || '',
    childReaction: parts[2] || '',
    parentSecondInterpretation: parts[3] || '',
    parentReinforcementAction: parts[4] || '',
    childFurtherStrategy: parts[5] || '',
    longTermEffect: parts[6] || '',
  }
}

/** LLM 的三档评分 → MechanismScore 0-1 数值（其余维度用三档平均兜底） */
function normScores(v: unknown): CandidateMechanism['scores'] {
  const map = (x: unknown) => (x === 'high' ? 0.9 : x === 'medium' ? 0.6 : x === 'low' ? 0.3 : 0.5)
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    const ep = map(o.explanatoryPower)
    const cc = map(o.crossSceneConsistency)
    const es = map(o.evidenceSupport)
    const avg = (ep + cc + es) / 3
    return {
      evidenceSpecificity: es,
      crossEntryRepetition: cc,
      explanatoryCoverage: ep,
      familyChainCompleteness: avg,
      protectiveFunctionClarity: avg,
      counterInfoCompatibility: avg,
      verifiability: avg,
      familySpecificity: avg,
    }
  }
  const fill = 0.5
  return {
    evidenceSpecificity: fill,
    crossEntryRepetition: fill,
    explanatoryCoverage: fill,
    familyChainCompleteness: fill,
    protectiveFunctionClarity: fill,
    counterInfoCompatibility: fill,
    verifiability: fill,
    familySpecificity: fill,
  }
}

interface RawMechanism {
  mechanismName?: string
  mechanismType?: string
  ecosystemLayer?: string
  description?: string
  supportedByEntries?: unknown
  supportingEvidence?: unknown
  explainedBehaviors?: unknown
  possibleProtectiveFunction?: string
  familyInteractionChain?: unknown
  scores?: unknown
  overallStrength?: string
  applicableScope?: string
  missingEvidence?: unknown
  possibleAlternativeExplanations?: unknown
  shouldPromoteToDiagnosis?: boolean
}

interface RawHypothesis {
  hypothesis?: string
  supportingEvidence?: unknown
  missingEvidence?: unknown
  verificationQuestions?: unknown
  weight?: string
  applicableScenes?: unknown
  status?: string
}

interface RawPattern {
  observations?: unknown
  interactionImplications?: unknown
  correctionReceptivity?: string
  factProvisionAbility?: string
}

interface DeepMechanismOutput {
  candidateMechanismMatrix?: RawMechanism[]
  pendingHypotheses?: RawHypothesis[]
  parentNarrativePattern?: RawPattern
  summary?: string
}

function normEntryNames(v: unknown): EntryName[] {
  const got = arr(v)
  return got.filter((x): x is EntryName => (ENTRY_NAMES as string[]).includes(x)) as EntryName[]
}

function normMechanism(m: RawMechanism, now: string): CandidateMechanism {
  const strength = normStrength(m.overallStrength)
  return {
    mechanismName: str(m.mechanismName, '未命名机制'),
    mechanismType: strengthToType(strength),
    description: str(m.description),
    supportedByEntries: normEntryNames(m.supportedByEntries),
    supportingEvidence: arr(m.supportingEvidence),
    explainedBehaviors: arr(m.explainedBehaviors),
    possibleProtectiveFunction: str(m.possibleProtectiveFunction),
    familyInteractionChain: normChain(m.familyInteractionChain),
    scores: normScores(m.scores),
    overallStrength: strength,
    applicableScope: str(m.applicableScope),
    missingEvidence: arr(m.missingEvidence),
    possibleAlternativeExplanations: arr(m.possibleAlternativeExplanations),
    shouldPromoteToDiagnosis: m.shouldPromoteToDiagnosis === true,
  }
}

export async function runDeepMechanismReview(tenant: TenantId): Promise<void> {
  const maturity = getCurrentMaturityState(tenant)

  const [
    packs,
    inputHistory,
    updates,
    existingNetwork,
    hypotheses,
    builtSnapshot,
    cycles,
    existingPattern,
  ] = await Promise.all([
    getEntryEvidencePacks(tenant),
    getMergedParentInputHistory(tenant, 100),
    getDailyInteractionUpdates(tenant),
    getLatestEvidenceNetwork(tenant),
    getPendingHypotheses(tenant),
    getLatestBuiltProfileSnapshot(tenant),
    getFamilyInteractionCycles(tenant),
    getParentNarrativePattern(tenant),
  ])

  // 信息严重不足：不空跑 LLM（省 token），no-op。四模块完成触发时 packs 已有内容。
  const totalFacts =
    packs.reduce((n, p) => n + (p.decomposedInput.verifiableFacts?.length || 0), 0) +
    (packs.reduce((n, p) => n + (p.decomposedInput.childBehaviors?.length || 0), 0)) +
    inputHistory.length
  if (totalFacts < 3) return // 合法 no-op

  // 喂给 LLM 的全量记忆（控制 token：packs 取摘要 + 最近 20 条日常输入）
  const packDigest = packs.map((p) => ({
    entryName: p.entryName,
    verifiableFacts: (p.decomposedInput.verifiableFacts || []).slice(0, 6),
    childBehaviors: (p.decomposedInput.childBehaviors || []).slice(0, 6),
    triggerPoints: (p.decomposedInput.triggerPoints || []).slice(0, 4),
    parentActions: (p.decomposedInput.parentActions || []).slice(0, 4),
    parentGoals: (p.decomposedInput.parentGoals || []).slice(0, 3),
    parentEvaluations: (p.decomposedInput.parentEvaluations || []).slice(0, 3),
  }))
  const recentInputs = inputHistory.slice(-20).map((h) => h.text).filter(Boolean)
  const existingMechanisms = existingNetwork?.candidateMechanismMatrix?.map((m) => ({
    mechanismName: m.mechanismName,
    overallStrength: m.overallStrength,
    applicableScope: m.applicableScope,
  })) || []
  const existingCycles = cycles.map((c) => ({
    cycleName: c.cycleName,
    parentTriggerAction: c.parentTriggerAction,
    childReaction: c.childReaction,
  }))
  const existingHypotheses = hypotheses.map((h) => ({ hypothesis: h.hypothesis, status: h.status }))

  const ai = await callAgentJson<DeepMechanismOutput>(
    'deepMechanismReview',
    '用五大生态系统+16家庭理论框架，读全量家庭记忆，产出回归家庭结构根因的深度机制（覆盖旧机制层）。',
    {
      entryPacks: packDigest,
      dailyUpdates: recentInputs,
      existingMechanisms,
      existingHypotheses,
      familyInteractionCycles: existingCycles,
      builtCoreJudgment: builtSnapshot?.coreJudgment || '',
      builtDeepMechanism: builtSnapshot?.deepMechanism || '',
      existingParentNarrative: existingPattern
        ? {
            observations: existingPattern.observations,
            interactionImplications: existingPattern.interactionImplications,
          }
        : null,
    }
  )

  if (!ai?.candidateMechanismMatrix || !Array.isArray(ai.candidateMechanismMatrix) || ai.candidateMechanismMatrix.length === 0) {
    return // LLM 未启用/失败 → 不改动，保持现状
  }

  const now = new Date().toISOString()

  // 覆盖 evidence_networks（share-layer：synthesis 保留 build 链，deep_mechanism 覆盖机制层）
  const coverage: Record<EntryName, 'missing' | 'partial' | 'sufficient' | 'strong'> = {
    learning_homework: 'missing',
    daily_rhythm_phone: 'missing',
    parent_child_communication: 'missing',
    emotional_stress: 'missing',
    relationship_environment: 'missing',
  }
  for (const p of packs) coverage[p.entryName] = 'sufficient'

  const network: CrossEntryEvidenceNetwork = {
    networkId: createId('net'),
    familyId: tenant.familyId,
    childId: tenant.childId,
    maturityLevel: maturity.level,
    inputCoverage: coverage,
    crossEntryEvidenceMap: existingNetwork?.crossEntryEvidenceMap || [],
    candidateMechanismMatrix: ai.candidateMechanismMatrix.map((m) => normMechanism(m, now)),
    createdAt: now,
    updatedAt: now,
  }
  await saveEvidenceNetwork(network, tenant)

  // 合并 pending_hypotheses：保留旧 supported/weakened/resolved/dismissed，追加新 pending
  const newHypotheses: PendingHypothesis[] = (ai.pendingHypotheses || [])
    .filter((h) => str(h.hypothesis))
    .map((h) => ({
      hypothesisId: createId('hyp'),
      familyId: tenant.familyId,
      childId: tenant.childId,
      hypothesis: str(h.hypothesis),
      triggerSource: 'deep_mechanism_review',
      supportingEvidence: arr(h.supportingEvidence),
      missingEvidence: arr(h.missingEvidence),
      verificationQuestions: arr(h.verificationQuestions),
      possibleCounterEvidence: [],
      weight: normWeight(h.weight),
      applicableScenes: arr(h.applicableScenes),
      status: 'pending',
      retrievalTags: [],
      createdAt: now,
      updatedAt: now,
    }))
  if (newHypotheses.length > 0) {
    const merged = [...hypotheses.filter((h) => h.status !== 'pending'), ...newHypotheses]
    await savePendingHypotheses(merged, tenant)
  }

  // parent_narrative_patterns：修复 dead write，deep_mechanism 是唯一综合写入者
  const rawPattern = ai.parentNarrativePattern
  if (rawPattern) {
    const pattern: ParentNarrativePattern = {
      patternId: createId('pnp'),
      familyId: tenant.familyId,
      childId: tenant.childId,
      observations: arr(rawPattern.observations).slice(0, 8),
      labelTendency: 'occasional',
      moralizeTendency: 'occasional',
      effortEmphasis: 'occasional',
      selfBlameTendency: 'occasional',
      correctionReceptivity: normReceptivity(rawPattern.correctionReceptivity),
      factProvisionAbility: normReceptivity(rawPattern.factProvisionAbility),
      interactionImplications: arr(rawPattern.interactionImplications).slice(0, 6),
      createdAt: now,
      updatedAt: now,
    }
    await saveParentNarrativePattern(pattern, tenant)
  }

  // share-layer 收尾：用最新深度机制刷新 built_profile_snapshots.deepMechanism，
  // 让前端 /profile/result 渲染的 deepMechanism 与 evidence_networks 同步（不再停留在 synthesis 旧文本）。
  if (builtSnapshot) {
    const topMechanism = network.candidateMechanismMatrix[0]
    const newDeepMechanism = topMechanism
      ? `${topMechanism.mechanismName}：${topMechanism.description}`.slice(0, 200)
      : builtSnapshot.deepMechanism
    if (newDeepMechanism && newDeepMechanism !== builtSnapshot.deepMechanism) {
      await saveBuiltProfileSnapshot(
        { ...builtSnapshot, deepMechanism: newDeepMechanism, updatedAt: now },
        tenant
      )
    }
  }
}

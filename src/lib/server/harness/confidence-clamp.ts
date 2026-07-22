/**
 * v4 harness：atom confidence 硬上限（确定性代码，非 LLM）
 *
 * episodeExtractor / atom_curation 产出的 confidence 是 LLM 主观打分，
 * 落库前必须按 evidenceTier × epistemicStatus 双上限钳制——
 * 这是「confidence 硬公式」在单条 atom 粒度的执行点（多源聚合见 bayesian.ts）。
 */

type EpistemicStatus = 'observed' | 'reported' | 'derived' | 'inferred' | 'hypothesized' | 'expert_confirmed'
type EvidenceTier = 'behavior' | 'verbatim' | 'repeated' | 'cross_scene' | 'outcome_checked'

/** 证据分层上限（对齐架构文档 2.3 表） */
const TIER_CEILING: Record<EvidenceTier, number> = {
  behavior: 0.6,
  verbatim: 0.85,
  repeated: 0.7,
  cross_scene: 0.8,
  outcome_checked: 0.9,
}

/** 认识论上限：inferred ≤0.3 / hypothesized ≤0.2 是防推断自我强化的硬线 */
const EPISTEMIC_CEILING: Record<EpistemicStatus, number> = {
  observed: 0.9,
  reported: 0.5,
  derived: 0.8,
  inferred: 0.3,
  hypothesized: 0.2,
  expert_confirmed: 0.95,
}

/** 未标 tier 的单次抱怨/抽象标签，SP 规定按 low 处理 */
const NO_TIER_CEILING = 0.5

export interface AtomConfidenceInput {
  confidence?: number
  epistemicStatus?: EpistemicStatus
  evidenceTier?: EvidenceTier
}

/**
 * 钳制单条 atom 的 confidence：
 * min(LLM 打分（缺省取上限）, tier 上限, 认识论上限)，下限 0.05。
 */
export function clampAtomConfidence(atom: AtomConfidenceInput): number {
  const tierCeiling = atom.evidenceTier ? TIER_CEILING[atom.evidenceTier] : NO_TIER_CEILING
  const epistemicCeiling = EPISTEMIC_CEILING[atom.epistemicStatus || 'reported']
  const ceiling = Math.min(tierCeiling, epistemicCeiling)
  const raw = typeof atom.confidence === 'number' && Number.isFinite(atom.confidence)
    ? atom.confidence
    : ceiling
  return Math.max(0.05, Math.min(raw, ceiling))
}

/**
 * 推断/假设不是高价值证据（episodeExtractor SP 硬规则）：
 * 即使 LLM 标了 isHighValue，也在此强制回收，防止推断进入向量检索池被前台当事实引用。
 */
export function enforceHighValueEligibility(
  isHighValue: boolean,
  epistemicStatus: EpistemicStatus | undefined
): boolean {
  if (epistemicStatus === 'inferred' || epistemicStatus === 'hypothesized') return false
  return isHighValue
}

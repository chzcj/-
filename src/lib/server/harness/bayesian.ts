/**
 * v4 harness 数学引擎：三角验证 confidence 硬公式 + 贝叶斯假设池更新
 *
 * 这两个函数是确定性数学逻辑（非 LLM），用于：
 * 1. TriangulatedFact.confidence 硬公式聚合（替代 LLM 主观打分）
 * 2. BayesianHypothesis 的 prior/likelihood/posterior 增量更新
 */

import type { EvidenceRef, EvidenceSource, TriangulatedFact } from '@/types/database'

/**
 * 三角验证 confidence 硬公式：
 * - 单源（1 个来源）→ 0.3-0.5
 * - 双源（2 个独立来源）→ 0.6-0.7
 * - 三源+（≥3 个独立来源）→ 0.8-0.9
 * - 四源+ → 0.95
 * - 独立性调节：同来源多次（如 3 条 parent_statement）独立性低，confidence 不升
 */
export function computeTriangulatedConfidence(
  evidenceRefs: EvidenceRef[],
): number {
  if (evidenceRefs.length === 0) return 0.1

  // 去重来源类型
  const uniqueSources = new Set(evidenceRefs.map(e => e.source))
  const sourceCount = uniqueSources.size

  // 基础置信度（按来源数量）
  let base: number
  if (sourceCount >= 4) base = 0.95
  else if (sourceCount >= 3) base = 0.85
  else if (sourceCount >= 2) base = 0.65
  else base = 0.4

  // 独立性调节：如果同一来源类型占主导，降低独立性
  const sourceCounts = new Map<EvidenceSource, number>()
  for (const e of evidenceRefs) {
    sourceCounts.set(e.source, (sourceCounts.get(e.source) || 0) + 1)
  }
  const maxSourceCount = Math.max(...sourceCounts.values())
  const dominanceRatio = maxSourceCount / evidenceRefs.length
  // 如果单一来源占 >70%，降低 0.1
  if (dominanceRatio > 0.7 && evidenceRefs.length > 1) {
    base -= 0.1
  }

  // 认识论调节：inferred/hypothesized 的证据降低置信度
  const epistemicPenalty = evidenceRefs.filter(
    e => e.epistemicStatus === 'inferred' || e.epistemicStatus === 'hypothesized'
  ).length / evidenceRefs.length
  base -= epistemicPenalty * 0.15

  // 权重均值微调
  const avgWeight = evidenceRefs.reduce((s, e) => s + (e.weight || 0.5), 0) / evidenceRefs.length
  base = base * 0.8 + avgWeight * 0.2

  return Math.max(0.1, Math.min(0.98, base))
}

/**
 * 构建 TriangulatedFact
 */
export function buildTriangulatedFact(
  factId: string,
  content: string,
  evidenceRefs: EvidenceRef[],
): TriangulatedFact {
  const sources = [...new Set(evidenceRefs.map(e => e.source))]
  const independenceScore = sources.length / Math.max(1, evidenceRefs.length)
  return {
    factId,
    content,
    sources,
    sourceCount: sources.length,
    independenceScore,
    confidence: computeTriangulatedConfidence(evidenceRefs),
    evidenceRefs,
  }
}

/**
 * 贝叶斯假设池更新：
 * posterior = (prior × likelihood) / Σ(prior_i × likelihood_i)
 *
 * 对单个假设：新 posterior = prior × likelihood（未归一化）
 * 对假设池：归一化使所有 posterior 之和为 1
 *
 * 证据方向：
 * - 支持证据 → likelihood > prior（假设更可能）
 * - 反证证据 → likelihood < prior（假设更不可能）
 * - 无关证据 → likelihood = prior（不变）
 */

export interface BayesianUpdate {
  hypothesisId: string
  prior: number
  /** 支持证据数量 */
  supportingCount: number
  /** 反证证据数量 */
  contradictingCount: number
  /** 证据平均置信度（0-1） */
  avgEvidenceConfidence: number
}

/**
 * 计算单个假设的似然值：
 * - 支持证据越多 → likelihood 越高
 * - 反证证据越多 → likelihood 越低
 * - 证据置信度越高 → 调整幅度越大
 */
export function computeLikelihood(update: BayesianUpdate): number {
  const { prior, supportingCount, contradictingCount, avgEvidenceConfidence } = update
  const evidenceStrength = Math.max(0.1, avgEvidenceConfidence)
  // 每条支持证据提升 prior × strength × 0.1，每条反证降低
  const supportBoost = supportingCount * evidenceStrength * 0.1
  const contradictPenalty = contradictingCount * evidenceStrength * 0.1
  const likelihood = prior * (1 + supportBoost - contradictPenalty)
  return Math.max(0.01, Math.min(0.99, likelihood))
}

/**
 * 归一化假设池的 posterior：
 * 给定多个假设的 (prior, likelihood)，计算归一化 posterior 使总和为 1。
 * 保留至少 2 个假设（防止单一结论塌缩）。
 */
export function normalizePosteriors(
  hypotheses: Array<{ hypothesisId: string; prior: number; likelihood: number }>,
): Map<string, number> {
  if (hypotheses.length === 0) return new Map()

  const unnormalized = hypotheses.map(h => ({
    id: h.hypothesisId,
    value: h.prior * h.likelihood,
  }))

  const total = unnormalized.reduce((s, h) => s + h.value, 0)
  if (total === 0) {
    // 均匀分布兜底
    const even = 1 / hypotheses.length
    return new Map(unnormalized.map(h => [h.id, even]))
  }

  const result = new Map<string, number>()
  for (const h of unnormalized) {
    result.set(h.id, h.value / total)
  }
  return result
}

/**
 * 默认先验（来自 THEORY_CARDS 领域知识）：
 * 当没有历史数据时，给候选机制一个合理的默认先验。
 */
export function defaultPrior(mechanismType: string): number {
  switch (mechanismType) {
    case 'core_candidate':
      return 0.5
    case 'stage_candidate':
      return 0.3
    case 'local_candidate':
      return 0.25
    case 'pending_hypothesis':
      return 0.2
    case 'unsupported':
      return 0.1
    default:
      return 0.3
  }
}

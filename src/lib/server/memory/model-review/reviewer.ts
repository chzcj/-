import 'server-only'
import { callAgentJson } from '@/lib/server/ark-agents'
import { getPendingHypotheses, savePendingHypotheses } from '@/lib/server/memory/database-manager'
import { retrieveContextPack } from '@/lib/server/memory/retrieval/episode-retriever'
import { computeLikelihood } from '@/lib/server/harness/bayesian'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { HypothesisWeight, PendingHypothesis } from '@/types/database'

/* ================================================================
   后台「家庭模型复核 Agent」（测评反馈 P2：FamilyModel 异步循环第一步）。
   拿已有 pending hypotheses 对照近期证据复核：找支持/反证、评置信度(weight)、定 status。
   谨慎——绝不在此把假设升为稳定结论；有反证则削弱。让后台模型越用越准。
   由 model_review job 触发（memory_write 写了假设后链式触发）；不吞异常驱动重试。

   v4 贝叶斯接线：LLM 只负责在材料里找支持/反证（定性判断），
   数值信念由硬公式推进：prior（上轮 posterior）→ likelihood → posterior，
   weight 由 posterior 映射而来，不再采信 LLM 主观档位。
   假设间非互斥，故做逐假设信念更新，不做池归一化（竞争假设归一在 dossier 层）。
   ================================================================ */

const REVIEW_BATCH_SIZE = 8

/** 序数 weight → 先验（历史数据无数值时的冷启动映射） */
const WEIGHT_PRIOR: Record<HypothesisWeight, number> = {
  very_low: 0.1,
  low: 0.25,
  medium: 0.45,
  medium_high: 0.6,
  high: 0.75,
}

function posteriorToWeight(posterior: number): HypothesisWeight {
  if (posterior >= 0.7) return 'high'
  if (posterior >= 0.55) return 'medium_high'
  if (posterior >= 0.35) return 'medium'
  if (posterior >= 0.2) return 'low'
  return 'very_low'
}

/** 证据池平均强度：sourceType 启发式（原话/材料观察 > 反证/反馈 > 其余） */
function estimateEvidenceConfidence(atoms: Array<{ sourceType: string }>): number {
  if (atoms.length === 0) return 0.5
  const score = (s: string): number =>
    s === 'child_quote' || s === 'material_observation' ? 0.8
    : s === 'counter_evidence' || s === 'feedback' ? 0.7
    : 0.55
  return atoms.reduce((sum, a) => sum + score(a.sourceType), 0) / atoms.length
}
function normStatus(v: unknown, current: PendingHypothesis['status']): PendingHypothesis['status'] {
  // 谨慎：本步只允许 pending/supported/weakened，绝不在此升 resolved（稳定结论）。
  return v === 'supported' || v === 'weakened' || v === 'pending' ? v : current
}
const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()) : []

interface ReviewItem { i?: number; weight?: string; status?: string; counterEvidence?: string[]; newSupport?: string[]; reasoning?: string }

export async function runModelReview(tenant: TenantId): Promise<void> {
  const all = await getPendingHypotheses(tenant)
  // 只复核仍活跃的假设（已 resolved/dismissed 的不动）。
  const active = all.filter(h => h.status === 'pending' || h.status === 'supported' || h.status === 'weakened')
  if (active.length === 0) return // 合法 no-op
  // 单户积累数十条假设时，一次输出所有 review 会造成 JSON 截断。
  // 按日桶轮换分批，保留每条假设的复核语义，同时让单次输出可控。
  const batchCount = Math.ceil(active.length / REVIEW_BATCH_SIZE)
  const batchIndex = Math.floor(Date.now() / 86_400_000) % batchCount
  const batchStart = batchIndex * REVIEW_BATCH_SIZE
  const reviewBatch = active.slice(batchStart, batchStart + REVIEW_BATCH_SIZE)
  console.info(
    `[model-review] active=${active.length} batch=${batchIndex + 1}/${batchCount} range=${batchStart}-${batchStart + reviewBatch.length - 1}`
  )

  // 拿近期证据（episodes + 高价值 atom，含 counter_evidence）对照复核。
  const query = reviewBatch.map(h => h.hypothesis).join('；').slice(0, 500)
  const pack = await retrieveContextPack(query, { familyId: tenant.familyId, childId: tenant.childId }).catch(() => undefined)
  const recentEpisodes = pack ? pack.episodes.map(e => e.summary).slice(0, 8) : []
  const highValueAtoms = pack
    ? [
        ...pack.episodes.flatMap(e => e.atoms.filter(a => a.isHighValue).map(a => ({ content: a.content, sourceType: a.sourceType }))),
        ...pack.extraHighValueAtoms.map(a => ({ content: a.content, sourceType: a.sourceType })),
      ].slice(0, 12)
    : []

  const ai = await callAgentJson<{ reviews?: ReviewItem[] }>(
    'modelReview',
    '复核这些待验证假设：对照近期证据找支持与反证，评估置信度(weight)并定 status。反证只能来自材料，谨慎不下稳定结论。',
    {
      hypotheses: reviewBatch.map((h, i) => ({
        i: batchStart + i,
        hypothesis: h.hypothesis,
        supportingEvidence: (h.supportingEvidence || []).slice(0, 3),
      })),
      recentEpisodes,
      highValueAtoms,
    },
    // 分批后最多 8 条 review，避免大户一次输出几十个 JSON 对象而截断。
    { maxTokens: 3072 }
  )
  if (!ai?.reviews || !Array.isArray(ai.reviews)) return // LLM 未启用/失败 → 不改动，保持原假设

  const byIndex = new Map<number, ReviewItem>()
  for (const r of ai.reviews) if (typeof r?.i === 'number') byIndex.set(r.i, r)

  const avgEvidenceConfidence = estimateEvidenceConfidence(highValueAtoms)
  const now = new Date().toISOString()
  const updated: PendingHypothesis[] = active.map((h, i) => {
    // LLM 收到的是 active 列表的全局索引（batchStart + i）；第 2 批起若按局部 i
    // 查，会让模型已完成的复核结果全部丢失，导致大户假设永远无法轮换写回。
    const r = byIndex.get(batchStart + i)
    // 旧版/外部写入的记录可能缺数组字段，统一兜底，避免展开 undefined 抛错（job 重试死循环）。
    const hCounter = Array.isArray(h.possibleCounterEvidence) ? h.possibleCounterEvidence : []
    const hSupport = Array.isArray(h.supportingEvidence) ? h.supportingEvidence : []
    if (!r) return { ...h, possibleCounterEvidence: hCounter, supportingEvidence: hSupport }
    const counter = arr(r.counterEvidence)
    const newSupport = arr(r.newSupport)

    // 贝叶斯硬公式：LLM 找证据（定性），公式定信念（定量）
    const prior = typeof h.posterior === 'number' ? h.posterior
      : typeof h.prior === 'number' ? h.prior
      : WEIGHT_PRIOR[h.weight || 'medium']
    const likelihood = computeLikelihood({
      hypothesisId: h.hypothesisId,
      prior,
      supportingCount: newSupport.length,
      contradictingCount: counter.length,
      avgEvidenceConfidence,
    })
    const posterior = likelihood

    // 确定性 status 铁律：有反证必 weakened（不靠 LLM 自觉）
    const llmStatus = normStatus(r.status, h.status || 'pending')
    const status = counter.length > 0 ? 'weakened' as const : llmStatus

    return {
      ...h,
      // weight 由 posterior 映射；LLM 档位仅在公式无新信号时作参考（此时 posterior≈prior，映射自然稳定）
      weight: posteriorToWeight(posterior),
      status,
      prior,
      likelihood,
      posterior,
      possibleCounterEvidence: counter.length > 0 ? Array.from(new Set([...hCounter, ...counter])) : hCounter,
      supportingEvidence: newSupport.length > 0 ? Array.from(new Set([...hSupport, ...newSupport])) : hSupport,
      updatedAt: now,
    }
  })

  await savePendingHypotheses(updated, tenant) // 不吞异常：异常上抛驱动 job 重试
}

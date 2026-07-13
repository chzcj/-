import 'server-only'
import { callAgentJson } from '@/lib/server/ark-agents'
import { getPendingHypotheses, savePendingHypotheses } from '@/lib/server/memory/database-manager'
import { retrieveContextPack } from '@/lib/server/memory/retrieval/episode-retriever'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { HypothesisWeight, PendingHypothesis } from '@/types/database'

/* ================================================================
   后台「家庭模型复核 Agent」（测评反馈 P2：FamilyModel 异步循环第一步）。
   拿已有 pending hypotheses 对照近期证据复核：找支持/反证、评置信度(weight)、定 status。
   谨慎——绝不在此把假设升为稳定结论；有反证则削弱。让后台模型越用越准。
   由 model_review job 触发（memory_write 写了假设后链式触发）；不吞异常驱动重试。
   ================================================================ */

const WEIGHTS: HypothesisWeight[] = ['very_low', 'low', 'medium', 'medium_high', 'high']
function normWeight(v: unknown, fallback: HypothesisWeight): HypothesisWeight {
  return typeof v === 'string' && (WEIGHTS as string[]).includes(v) ? v as HypothesisWeight : fallback
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

  // 拿近期证据（episodes + 高价值 atom，含 counter_evidence）对照复核。
  const query = active.map(h => h.hypothesis).join('；').slice(0, 500)
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
      hypotheses: active.map((h, i) => ({ i, hypothesis: h.hypothesis, supportingEvidence: (h.supportingEvidence || []).slice(0, 3) })),
      recentEpisodes,
      highValueAtoms,
    },
    // 多条假设逐一复核时输出较长，默认 2048 截断 JSON（failed job "Unexpected end of JSON input" 主因之一）
    { maxTokens: 3072 }
  )
  if (!ai?.reviews || !Array.isArray(ai.reviews)) return // LLM 未启用/失败 → 不改动，保持原假设

  const byIndex = new Map<number, ReviewItem>()
  for (const r of ai.reviews) if (typeof r?.i === 'number') byIndex.set(r.i, r)

  const now = new Date().toISOString()
  const updated: PendingHypothesis[] = active.map((h, i) => {
    const r = byIndex.get(i)
    // 旧版/外部写入的记录可能缺数组字段，统一兜底，避免展开 undefined 抛错（job 重试死循环）。
    const hCounter = Array.isArray(h.possibleCounterEvidence) ? h.possibleCounterEvidence : []
    const hSupport = Array.isArray(h.supportingEvidence) ? h.supportingEvidence : []
    if (!r) return { ...h, possibleCounterEvidence: hCounter, supportingEvidence: hSupport }
    const counter = arr(r.counterEvidence)
    const newSupport = arr(r.newSupport)
    return {
      ...h,
      weight: normWeight(r.weight, h.weight || 'medium'),
      status: normStatus(r.status, h.status || 'pending'),
      possibleCounterEvidence: counter.length > 0 ? Array.from(new Set([...hCounter, ...counter])) : hCounter,
      supportingEvidence: newSupport.length > 0 ? Array.from(new Set([...hSupport, ...newSupport])) : hSupport,
      updatedAt: now,
    }
  })

  await savePendingHypotheses(updated, tenant) // 不吞异常：异常上抛驱动 job 重试
}

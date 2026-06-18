import 'server-only'
import { callAgentJson } from '@/lib/server/ark-agents'
import { buildMemoryWritePlan } from '@/lib/server/memory/write/decision-engine'
import { getPendingHypotheses } from '@/lib/server/memory/database-manager'
import { createId } from '@/lib/storage/storageIds'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { MemoryWritePlan, PendingHypothesis, HypothesisWeight } from '@/types/database'

/* ================================================================
   日常对话深拆 Agent（DailyDeep，daily_deep job）。
   把一轮日常对话原话异步六维深拆，并【仅在出现明显新机制时】保守生成 0-2 条待验证假设。
   - 不执行写入，返回 plan，由 queue.runJob 入队 memory_write（复用 →digest_update / →model_review 链）。
   - 无 key / LLM 失败 / 无新机制 → 返回 null（合法 no-op，daily 主链路不退化、不空跑）。
   - 去重：不重建已存在的假设，避免重复，也避免把 model_review 已更新的 status 重置回 pending。
   ================================================================ */

export interface DailyDeepPayload {
  text: string
  tenant: TenantId
  traceId?: string
}

interface DailyDecomposeAi {
  sixDim?: {
    facts?: string[]
    childQuotes?: string[]
    parentActions?: string[]
    triggerPoints?: string[]
    parentEmotions?: string[]
    parentGoals?: string[]
  }
  newHypotheses?: Array<{
    hypothesis?: string
    weight?: string
    missingEvidence?: string[]
    verificationQuestions?: string[]
  }>
}

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()) : []

export async function runDailyDeep(p: DailyDeepPayload): Promise<{ plan: MemoryWritePlan; tenant: TenantId } | null> {
  if (!p.text?.trim()) return null // 合法 no-op

  const ai = await callAgentJson<DailyDecomposeAi>(
    'dailyDecompose',
    '把这轮日常对话深拆为六维结构，并仅在出现明显新机制时给出 1-2 条待验证假设；多数日常轮应为空。',
    { text: p.text }
  )
  if (!ai) return null // 无 key / LLM 失败 → no-op

  const candidates = (ai.newHypotheses || [])
    .map(h => ({
      hypothesis: typeof h?.hypothesis === 'string' ? h.hypothesis.trim() : '',
      weight: h?.weight,
      missingEvidence: h?.missingEvidence,
      verificationQuestions: h?.verificationQuestions,
    }))
    .filter(h => h.hypothesis.length > 0)
    .slice(0, 2)
  if (candidates.length === 0) return null // 多数日常轮无新机制 → 不建假设

  // 去重：跳过文本上已存在的假设（避免重复 + 避免重置 model_review 已更新的 status）。
  const existing = await getPendingHypotheses(p.tenant).catch(() => [] as PendingHypothesis[])
  const existingTexts = new Set(existing.map(h => h.hypothesis.trim()))
  const fresh = candidates.filter(h => !existingTexts.has(h.hypothesis))
  if (fresh.length === 0) return null

  const now = new Date().toISOString()
  const evidenceSnippet = p.text.trim().slice(0, 200)
  const hypotheses: PendingHypothesis[] = fresh.map((h) => ({
    hypothesisId: `hyp-daily-${createId('h')}`,
    familyId: p.tenant.familyId,
    childId: p.tenant.childId,
    hypothesis: h.hypothesis,
    triggerSource: 'daily_dialogue',
    supportingEvidence: [evidenceSnippet],
    missingEvidence: arr(h.missingEvidence),
    verificationQuestions: arr(h.verificationQuestions),
    possibleCounterEvidence: [],
    weight: (h.weight === 'medium' ? 'medium' : 'low') as HypothesisWeight, // 日常单轮起步低权重，靠 model_review 加权/反证
    applicableScenes: [],
    status: 'pending',
    retrievalTags: [],
    createdAt: now,
    updatedAt: now,
  }))

  const plan = buildMemoryWritePlan({
    tenant: p.tenant,
    pendingHypotheses: hypotheses,
    rationale: {
      whyUpdate: '日常对话深拆，发现可能的新机制（待验证假设）',
      whyNotPromoteSomeItems: '日常单轮证据有限，仅作低权重待验证假设，不升级为长期判断',
      riskOfOvergeneralization: '单轮对话不足以下稳定结论，须经 model_review 反证收集',
      nextVerificationNeed: hypotheses.map(h => h.hypothesis).join('；'),
    },
  })
  return { plan, tenant: p.tenant }
}

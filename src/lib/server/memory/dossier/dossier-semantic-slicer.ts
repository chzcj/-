import 'server-only'

/* ================================================================
   v4.1 语义激活切片 — 「当前问题 → 激活相关机制」的升级实现
   ================================================================
   旧 sliceForDaily 用 3 个正则分支决定下发哪些 dossier 组件，
   sceneReadings 固定取前 2 条，与本轮问题无关。
   本模块改为：query embedding × 组件 embedding（落库时预计算）余弦排序，
   按相关度取 top-k 场景/维持因素/保护因素——作业问题激活作业场景，
   睡前问题激活睡前场景。

   降级链：embedding 不可用 / 组件 embedding 缺失或版本不符 / query 为空
   → 回退旧 sliceForDaily 正则行为（永不失败）。
   意图分支保留：要办法/自我反思是「意图」不是「语义内容」，正则更可靠。
   ================================================================ */

import { cosineSimilarity, embedText, isEmbeddingEnabled } from '@/lib/server/memory/embedding'
import {
  loadDossierComponentEmbeddings,
  type DossierComponentEmbedding,
} from '@/lib/server/memory/deep-modeling/digest-store'
import {
  sliceForDaily,
  factorLine,
  topAlternativeReading,
  type DossierSlice,
} from './dossier-slicer'
import type { FamilyUnderstandingDossier } from '@/types/family-understanding-dossier'
import type { TenantId } from '@/lib/server/memory/tenant'

const ADVICE_HINT = /怎么办|怎么弄|有什么办法|建议/
/** 自我反思意图收窄为强信号（旧版单字「我」几乎命中所有输入） */
const SELF_HINT = /是不是我|我的问题|我管太多|我做错|我是不是/

function firstSentence(text: string): string {
  const t = text.trim()
  if (!t) return ''
  const m = t.match(/^[^。！？.!?]+[。！？.!?]?/)
  return (m?.[0] || t.slice(0, 120)).trim()
}

/** 按 kind 取与 query 最相关的 top-k 组件下标 */
function topKIndexes(
  items: DossierComponentEmbedding[],
  queryVector: number[],
  kind: DossierComponentEmbedding['kind'],
  k: number
): number[] {
  return items
    .filter((c) => c.kind === kind)
    .map((c) => ({ index: c.index, score: cosineSimilarity(queryVector, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((c) => c.index)
}

export async function sliceForDailySemantic(
  query: string,
  dossier: FamilyUnderstandingDossier | null | undefined,
  tenant: TenantId
): Promise<DossierSlice> {
  if (!dossier?.workingHypothesis?.text) return {}
  const q = query.trim()
  if (!q || !isEmbeddingEnabled()) return sliceForDaily(q, dossier)

  const pack = await loadDossierComponentEmbeddings(tenant).catch(() => null)
  // 版本不符说明 embedding 是旧 dossier 的，语义排序会错位——回退
  if (!pack?.items?.length || pack.dossierVersion !== dossier.version) {
    return sliceForDaily(q, dossier)
  }
  const queryVector = await embedText(q).catch(() => null)
  if (!queryVector) return sliceForDaily(q, dossier)

  const base: DossierSlice = {
    workingHypothesis: dossier.workingHypothesis.text,
    integratedSynthesisLead: firstSentence(dossier.integratedSynthesis || ''),
    alternativeReadings: topAlternativeReading(dossier),
  }

  const sceneIdx = topKIndexes(pack.items, queryVector, 'scene', 2)
  const sceneReadings = sceneIdx
    .map((i) => dossier.sceneReadings[i])
    .filter(Boolean)
    .map((s) => `${s.scene}：${s.reading}`)

  // 意图：要办法 → 干预靶点（按相关度排序）+ 相关场景
  if (ADVICE_HINT.test(q)) {
    const targetIdx = topKIndexes(pack.items, queryVector, 'intervention', 3)
    const interventionTargets = (targetIdx.length > 0
      ? targetIdx.map((i) => dossier.interventionTargets[i]).filter(Boolean)
      : dossier.interventionTargets.slice(0, 3)
    ).map((t) => t.action)
    return { ...base, interventionTargets, sceneReadings }
  }

  // 意图：自我反思 → 家长视角（按相关度）+ 相关场景
  if (SELF_HINT.test(q)) {
    const pIdx = topKIndexes(pack.items, queryVector, 'parentPerspective', 2)
    const parentPerspectives = (pIdx.length > 0
      ? pIdx.map((i) => dossier.parentPerspectives[i]).filter(Boolean)
      : dossier.parentPerspectives.slice(0, 2)
    ).map((p) => `${p.role}：${p.intent || ''} → 孩子感受 ${p.childReception || '未明'}；盲点 ${p.blindSpot || '待观察'}`)
    return { ...base, parentPerspectives, sceneReadings }
  }

  // 默认：语义激活的场景 + 维持/保护因素
  const perpIdx = topKIndexes(pack.items, queryVector, 'perpetuating', 2)
  const protIdx = topKIndexes(pack.items, queryVector, 'protective', 2)
  const perpetuating = perpIdx
    .map((i) => (dossier.fivePs.perpetuating || [])[i])
    .filter(Boolean)
    .map(factorLine)
  const protective = protIdx
    .map((i) => (dossier.fivePs.protective || [])[i])
    .filter(Boolean)
    .map(factorLine)

  return {
    ...base,
    sceneReadings,
    perpetuating: perpetuating.length > 0 ? perpetuating : undefined,
    protective: protective.length > 0 ? protective : undefined,
  }
}

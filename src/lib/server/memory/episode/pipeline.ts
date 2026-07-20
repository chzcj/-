import 'server-only'
import { createHash } from 'node:crypto'
import { callAgentJson } from '@/lib/server/ark-agents'
import { embedText, embedTexts, isEmbeddingEnabled } from '@/lib/server/memory/embedding'
import { upsertEpisodes, upsertAtoms, deleteAtomsByEpisode, type EpisodeRow, type AtomRow } from '@/lib/server/db'

/* ================================================================
   Episode Pipeline — 后台把家长本轮输入抽取为
   EvidenceEpisode（语义完整召回单元）+ FactAtom（原子证据），并向量化持久化。
   Episode 总向量化；只有高价值 Atom 单独向量化，普通 Atom 依附 Episode。

   两个入口：
   - ingestEpisodeStrict：不吞异常，供 job_queue handler 调用（异常→重试，区分合法 no-op）。
   - ingestEpisode：薄壳，try/catch 吞异常，供 DB 未启用降级 / 老 fire-and-forget 调用方。
   幂等：episodeId 确定派生（重试 upsert 同一行，不重复建）；atomId 下标派生 + DELETE-then-insert。
   ================================================================ */

interface ExtractedAtom {
  content: string
  sourceType: string
  factType?: string
  isHighValue?: boolean
  evidenceStrength?: string
  /** v3 元数据：具体行为/原话/多次/跨场景/有结果对照 */
  evidenceTier?: 'behavior' | 'verbatim' | 'repeated' | 'cross_scene' | 'outcome_checked'
  ecologicalLayer?: 'micro' | 'meso' | 'exo' | 'macro' | 'chrono'
  factRole?: 'presenting' | 'trigger' | 'response' | 'counter' | 'context'
}

interface ExtractedEpisode {
  episode: {
    summary: string
    parentInterpretation?: string
    missingInfo?: string[]
    sceneTags?: string[]
    mechanismTags?: string[]
  }
  atoms?: ExtractedAtom[]
}

// 高价值：孩子原话 / 材料观察 / 反证 / 执行反馈（这些才单独向量化）。
const HIGH_VALUE_SOURCES = new Set(['child_quote', 'material_observation'])
const HIGH_VALUE_FACTS = new Set(['counter_evidence', 'feedback'])

function isHighValueAtom(a: ExtractedAtom): boolean {
  return Boolean(a.isHighValue)
    || HIGH_VALUE_SOURCES.has(a.sourceType)
    || (a.factType ? HIGH_VALUE_FACTS.has(a.factType) : false)
}

export interface IngestContext {
  sourceEventId?: string
  recentContext?: string
  familyId?: string
  childId?: string
  requestId?: string  // 客户端幂等令牌（Idempotency-Key），优先用于派生 episodeId
  episodeId?: string  // 显式指定（job handler 透传，保证重试用同一 id）
  // 材料理解专用：整段输入来自家长上传的材料（老师反馈/作业/录音转写/截图文字）。
  // 传给抽取器作 materialHint，让其把材料里的客观陈述标 sourceType=material_observation。
  materialSource?: { isMaterial: boolean; materialType?: string }
}

// 确定派生 episodeId：有客户端令牌用之，否则按 (tenant + sha(text)) 去重同文本重复提交。
export function deriveEpisodeId(text: string, ctx: IngestContext): string {
  const seed = ctx.requestId
    ? `req:${ctx.requestId}`
    : `${ctx.familyId || 'f_demo'}:${ctx.childId || 'c_demo'}:${createHash('sha256').update(text).digest('hex')}`
  return `ep_${createHash('sha256').update(seed).digest('hex').slice(0, 24)}`
}

// 不吞异常内核：供 job handler 调用。异常上抛→重试；合法 no-op 正常 return；
// pgvector 不可用抛 EPISODE_VECTOR_UNAVAILABLE 供 handler fail-fast（不耗尽 attempts）。
export async function ingestEpisodeStrict(text: string, ctx: IngestContext = {}): Promise<void> {
  if (!text.trim() || !isEmbeddingEnabled()) return // 合法 no-op
  const extracted = await callAgentJson<ExtractedEpisode>(
    'episodeExtractor',
    '把家长这段话整理成一个 Episode 并拆出 Atoms。',
    {
      parentText: text,
      recentContext: ctx.recentContext || '',
      // 仅材料理解入口会带：让抽取器把材料里的客观陈述标 material_observation。
      ...(ctx.materialSource?.isMaterial ? { materialHint: ctx.materialSource } : {})
    }
  )
  if (!extracted?.episode?.summary?.trim()) return // 合法 no-op

  const ep = extracted.episode
  const episodeId = ctx.episodeId || deriveEpisodeId(text, ctx)
  const nowIso = new Date().toISOString()

  const episodeRow: EpisodeRow = {
    episodeId,
    familyId: ctx.familyId,
    childId: ctx.childId,
    sourceEventId: ctx.sourceEventId,
    summary: ep.summary.trim(),
    parentInterpretation: ep.parentInterpretation,
    missingInfo: Array.isArray(ep.missingInfo) ? ep.missingInfo : [],
    sceneTags: Array.isArray(ep.sceneTags) ? ep.sceneTags : [],
    mechanismTags: Array.isArray(ep.mechanismTags) ? ep.mechanismTags : [],
    embedding: await embedText(ep.summary.trim()),
    sourceCreatedAt: nowIso
  }

  const atoms = Array.isArray(extracted.atoms)
    ? extracted.atoms.filter(a => a?.content?.trim())
    : []
  const highValueFlags = atoms.map(isHighValueAtom)
  const toEmbed = atoms.filter((_, i) => highValueFlags[i]).map(a => a.content.trim())
  const hvVectors = toEmbed.length > 0 ? await embedTexts(toEmbed) : []

  let hvIdx = 0
  const atomRows: AtomRow[] = atoms.map((a, i) => {
    const hv = highValueFlags[i]
    const embedding = hv ? (hvVectors[hvIdx++] ?? null) : null
    return {
      atomId: `${episodeId}_a${i}`, // 下标派生（幂等）
      episodeId,
      familyId: ctx.familyId,
      childId: ctx.childId,
      content: a.content.trim(),
      sourceType: a.sourceType || 'parent_explicit',
      factType: a.factType,
      isHighValue: hv,
      evidenceStrength: a.evidenceStrength || 'medium',
      embedding,
    }
  })

  // 抽取器偶发返回 0 atom：用 episode summary 落一条低价值 scene atom，避免「空 episode」
  if (!atomRows.length && ep.summary.trim()) {
    atomRows.push({
      atomId: `${episodeId}_a0`,
      episodeId,
      familyId: ctx.familyId,
      childId: ctx.childId,
      content: ep.summary.trim(),
      sourceType: 'parent_explicit',
      factType: 'scene',
      isHighValue: false,
      evidenceStrength: 'low',
      embedding: null,
    })
  }

  const epResult = await upsertEpisodes([episodeRow])
  if (epResult === undefined) throw new Error('EPISODE_VECTOR_UNAVAILABLE') // 不静默，handler fail-fast
  await deleteAtomsByEpisode(episodeId) // 先删旧 atom，重试不留孤儿/重复
  if (atomRows.length > 0) await upsertAtoms(atomRows)

  if (ctx.familyId && ctx.childId) {
    const tenant = { familyId: ctx.familyId, childId: ctx.childId }
    const quoteAtom = atomRows.find((a) => a.sourceType === 'child_quote' || a.isHighValue)
    const rawEvidence = quoteAtom?.content || ep.summary.trim()
    void import('@/lib/server/profile/handbook-enriched-candidate').then(({ saveEnrichedHandbookCandidate }) =>
      saveEnrichedHandbookCandidate(tenant, {
        source: 'episode_atom',
        sourceRef: quoteAtom?.atomId || episodeId,
        rawEvidence,
        contextSummary: ep.summary.trim(),
        occurredAt: nowIso,
      })
    ).catch(() => undefined)
  }
}

// 薄壳：吞异常，供 DB 未启用的 inline 降级 / 不经队列的老调用方。
export async function ingestEpisode(text: string, ctx: IngestContext = {}): Promise<void> {
  try {
    await ingestEpisodeStrict(text, ctx)
  } catch (err) {
    console.error('[episode] 抽取/写入失败（降级路径，不影响前台）:', err)
  }
}

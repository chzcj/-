import 'server-only'
import { embedText } from '@/lib/server/memory/embedding'
import {
  searchEpisodes,
  searchHighValueAtoms,
  getAtomsByEpisodeIds,
  type FactAtomRecord
} from '@/lib/server/db'
import { autoTagQuery } from '@/lib/server/memory/index-tag-engine'

/* ================================================================
   Episode Retriever — 三段式语义检索
   ① query 编码 + 标签软过滤 → ② Episode 向量召回 → ③ Atom 依附 + 高价值 Atom + 加权精排组装
   pgvector / embedding 不可用时返回 undefined，驱动上层降级。
   ================================================================ */

export interface ContextPackAtom {
  content: string
  sourceType: string
  isHighValue: boolean
}

export interface ContextPackEpisode {
  summary: string
  parentInterpretation?: string
  missingInfo: string[]
  atoms: ContextPackAtom[]
  score: number
}

export interface ContextPack {
  episodes: ContextPackEpisode[]
  extraHighValueAtoms: Array<{ content: string; sourceType: string }>
}

const TAU = Math.max(1, Number(process.env.RETRIEVAL_TIME_TAU || 30))
const COARSE_K = Math.max(1, Number(process.env.RETRIEVAL_COARSE_K || 20))

function timeDecay(sourceCreatedAt?: string): number {
  if (!sourceCreatedAt) return 0.5
  const t = new Date(sourceCreatedAt).getTime()
  if (!Number.isFinite(t)) return 0.5
  const ageDays = Math.max(0, (Date.now() - t) / 86_400_000)
  return Math.exp(-ageDays / TAU)
}

export interface RetrieveOpts {
  topN?: number
  familyId?: string
  childId?: string
}

export async function retrieveContextPack(query: string, opts: RetrieveOpts = {}): Promise<ContextPack | undefined> {
  if (!query.trim()) return undefined
  const queryVector = await embedText(query)
  if (!queryVector) return undefined // embedding 不可用 → 降级

  const { sceneTags, mechanismTags } = autoTagQuery(query)
  const hits = await searchEpisodes(queryVector, {
    familyId: opts.familyId,
    childId: opts.childId,
    sceneTags,
    mechanismTags,
    topK: COARSE_K
  })
  if (hits === undefined) return undefined // pgvector 不可用 → 降级
  if (hits.length === 0) return { episodes: [], extraHighValueAtoms: [] }

  // 精排：向量相似度（0.7）+ 时间衰减（0.3）
  const topN = opts.topN || 5
  const ranked = hits
    .map(h => ({ h, score: 0.7 * (1 - h.distance) + 0.3 * timeDecay(h.sourceCreatedAt) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)

  // 依附取出场景包内全部 Atom（含普通的）
  const atoms = (await getAtomsByEpisodeIds(ranked.map(r => r.h.episodeId), opts.familyId, opts.childId)) || []
  const atomsByEpisode = new Map<string, FactAtomRecord[]>()
  for (const a of atoms) {
    const arr = atomsByEpisode.get(a.episodeId) || []
    arr.push(a)
    atomsByEpisode.set(a.episodeId, arr)
  }

  const episodes: ContextPackEpisode[] = ranked.map(r => ({
    summary: r.h.summary,
    parentInterpretation: r.h.parentInterpretation,
    missingInfo: r.h.missingInfo,
    atoms: (atomsByEpisode.get(r.h.episodeId) || []).map(a => ({
      content: a.content,
      sourceType: a.sourceType,
      isHighValue: a.isHighValue
    })),
    score: r.score
  }))

  // 额外召回跨 Episode 的高价值 Atom（孩子原话 / 反证 / 执行反馈等）
  const hvAtoms = (await searchHighValueAtoms(queryVector, {
    familyId: opts.familyId,
    childId: opts.childId,
    topK: 5
  })) || []
  const extraHighValueAtoms = hvAtoms.map(a => ({ content: a.content, sourceType: a.sourceType }))

  return { episodes, extraHighValueAtoms }
}

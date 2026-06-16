import 'server-only'
import { callAgentJson } from '@/lib/server/ark-agents'
import { embedText, embedTexts, isEmbeddingEnabled } from '@/lib/server/memory/embedding'
import { upsertEpisodes, upsertAtoms, type EpisodeRow, type AtomRow } from '@/lib/server/db'
import { createId } from '@/lib/storage/storageIds'

/* ================================================================
   Episode Pipeline — 后台把家长本轮输入抽取为
   EvidenceEpisode（语义完整召回单元）+ FactAtom（原子证据），并向量化持久化。
   Episode 总向量化；只有高价值 Atom 单独向量化，普通 Atom 依附 Episode。
   整体 try/catch，绝不阻塞前台回复。
   ================================================================ */

interface ExtractedAtom {
  content: string
  sourceType: string
  factType?: string
  isHighValue?: boolean
  evidenceStrength?: string
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
}

export async function ingestEpisode(text: string, ctx: IngestContext = {}): Promise<void> {
  if (!text.trim() || !isEmbeddingEnabled()) return
  try {
    const extracted = await callAgentJson<ExtractedEpisode>(
      'episodeExtractor',
      '把家长这段话整理成一个 Episode 并拆出 Atoms。',
      { parentText: text, recentContext: ctx.recentContext || '' }
    )
    if (!extracted?.episode?.summary?.trim()) return

    const ep = extracted.episode
    const episodeId = createId('ep')
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
        atomId: createId('atom'),
        episodeId,
        familyId: ctx.familyId,
        childId: ctx.childId,
        content: a.content.trim(),
        sourceType: a.sourceType || 'parent_explicit',
        factType: a.factType,
        isHighValue: hv,
        evidenceStrength: a.evidenceStrength || 'medium',
        embedding
      }
    })

    const epResult = await upsertEpisodes([episodeRow])
    if (epResult === undefined) return // pgvector 不可用，放弃（检索走降级链）
    if (atomRows.length > 0) await upsertAtoms(atomRows)
  } catch (err) {
    console.error('[episode] 抽取/写入失败（不影响前台）:', err)
  }
}

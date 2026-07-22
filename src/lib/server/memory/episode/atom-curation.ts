import 'server-only'

import { callAgentJson } from '@/lib/server/ark-agents'
import { getMergedParentInputHistory } from '@/lib/server/memory/database-manager'
import { upsertAtoms, type AtomRow } from '@/lib/server/db'
import { embedTexts } from '@/lib/server/memory/embedding'
import { createId } from '@/lib/storage/storageIds'
import { clampAtomConfidence, enforceHighValueEligibility } from '@/lib/server/harness/confidence-clamp'
import type { TenantId } from '@/lib/server/memory/tenant'

interface CuratedAtom {
  content: string
  sourceType: string
  factType: string
  evidenceTier?: 'behavior' | 'verbatim' | 'repeated' | 'cross_scene' | 'outcome_checked'
  factRole?: 'presenting' | 'trigger' | 'response' | 'counter' | 'context'
  epistemicStatus?: 'observed' | 'reported' | 'derived' | 'inferred' | 'hypothesized' | 'expert_confirmed'
  confidence?: number
}

/**
 * v4：每10轮高精选——从近期家长原话中做一次高浓缩提取，
 * 产出带情境的高质量 atom（不是裸事实，而是"场景+事实+反应"的浓缩）。
 *
 * 与 episodeExtractor 的区别：
 * - episodeExtractor 是每轮即时抽取，atom 可能碎
 * - atom_curation 是批量回看近10轮，发现跨轮的高价值模式，产出情境化浓缩 atom
 */
export async function runAtomCuration(tenant: TenantId): Promise<number> {
  const recentInputs = await getMergedParentInputHistory(tenant, 10)
  if (recentInputs.length < 3) return 0

  const corpus = recentInputs.map(r => r.text).filter(Boolean).join('\n---\n')
  if (corpus.length < 50) return 0

  const ai = await callAgentJson<{
    curatedAtoms: CuratedAtom[]
  }>(
    'episodeExtractor',
    '从近期10轮家长输入中做高精选：发现跨轮的高价值模式，产出带情境的浓缩 atom（不是裸事实，而是场景+事实+反应的浓缩）',
    {
      batchMode: true,
      parentInputs: recentInputs.map((r, i) => ({ round: i + 1, text: r.text })),
      instruction: '这是跨轮批量精选模式。从这10轮家长输入中发现：1) 反复出现的冲突模式 2) 孩子原话 3) 反证/变化信号。每条 atom 必须带场景标签和情境线索，30-80字。只产出高价值的，宁少勿多（3-8条）。',
    },
    { maxTokens: 4096 }
  )

  if (!ai?.curatedAtoms?.length) return 0

  const validAtoms = ai.curatedAtoms.filter(a => a.content && a.content.length > 10)
  if (!validAtoms.length) return 0

  const embeddings = await embedTexts(validAtoms.map(a => a.content))
  const rows: AtomRow[] = validAtoms.map((a, i) => {
    const epistemicStatus = a.epistemicStatus || 'derived'
    const evidenceTier = a.evidenceTier || 'cross_scene'
    return {
      atomId: createId('cur'),
      episodeId: `curation_${Date.now()}`,
      familyId: tenant.familyId,
      childId: tenant.childId,
      content: a.content,
      sourceType: a.sourceType || 'parent_explicit',
      factType: a.factType || 'behavior',
      isHighValue: enforceHighValueEligibility(true, epistemicStatus),
      evidenceStrength: 'high',
      embedding: embeddings[i],
      epistemicStatus,
      evidenceTier,
      factRole: a.factRole,
      // 硬公式钳制：tier × 认识论双上限，覆盖 LLM 主观打分
      confidence: clampAtomConfidence({ confidence: a.confidence, epistemicStatus, evidenceTier }),
    }
  })

  await upsertAtoms(rows)
  console.info(`[atom_curation] 家庭 ${tenant.familyId} 精选 ${rows.length} 条高质量情境化 atom`)
  return rows.length
}

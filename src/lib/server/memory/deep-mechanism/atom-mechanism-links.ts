import 'server-only'

/* ================================================================
   v4.1 atom→机制反向索引构建
   ================================================================
   theoryMatcher 的 matchedFactIds 指向入口证据包事实（正向：机制→证据已回填），
   但 atom（对话原子事实）与机制之间没有结构链接。
   本模块在 deep_mechanism_review 落库后，用机制文本 embedding 对高价值 atom
   做向量检索，把「哪些 atom 支撑哪些机制」写回 fact_atoms.supported_mechanism_names。

   消费方：检索侧可按被激活机制过滤/提升 atom 排序（见 router domainAtomFacts）。
   每轮深度复核整族替换，机制集变化时旧链接自动失效。失败不阻断主流程。
   ================================================================ */

import { embedTexts, isEmbeddingEnabled } from '@/lib/server/memory/embedding'
import { replaceAtomMechanismLinks, searchHighValueAtoms } from '@/lib/server/db'
import type { CandidateMechanism } from '@/types/database'
import type { TenantId } from '@/lib/server/memory/tenant'

/** 语义距离阈值：cosine distance ≤ 此值才认为 atom 支撑该机制（宁缺勿滥） */
const LINK_DISTANCE_THRESHOLD = 0.6
const MAX_MECHANISMS = 8
const ATOMS_PER_MECHANISM = 6

export async function linkAtomsToMechanisms(
  matrix: CandidateMechanism[],
  tenant: TenantId
): Promise<number> {
  if (!isEmbeddingEnabled()) return 0
  const mechanisms = matrix
    .filter((m) => m.overallStrength !== 'low' && m.mechanismName?.trim())
    .slice(0, MAX_MECHANISMS)
  if (mechanisms.length === 0) return 0

  const vectors = await embedTexts(
    mechanisms.map((m) => `${m.mechanismName} ${m.description || ''}`.slice(0, 500))
  )

  const linkMap = new Map<string, Set<string>>()
  for (let i = 0; i < mechanisms.length; i += 1) {
    const vector = vectors[i]
    if (!vector) continue
    const hits = await searchHighValueAtoms(vector, {
      familyId: tenant.familyId,
      childId: tenant.childId,
      topK: ATOMS_PER_MECHANISM,
    }).catch(() => undefined)
    for (const hit of hits || []) {
      if (hit.distance > LINK_DISTANCE_THRESHOLD) continue
      const set = linkMap.get(hit.atomId) || new Set<string>()
      set.add(mechanisms[i].mechanismName)
      linkMap.set(hit.atomId, set)
    }
  }

  const links = [...linkMap.entries()].map(([atomId, names]) => ({
    atomId,
    mechanismNames: [...names].slice(0, 4),
  }))
  await replaceAtomMechanismLinks(links, tenant.familyId, tenant.childId)
  return links.length
}

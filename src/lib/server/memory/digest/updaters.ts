import 'server-only'
import { createHash } from 'node:crypto'
import { callAgentJson } from '@/lib/server/ark-agents'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import {
  getLatestBoardHash,
  insertBoardSnapshot,
  upsertFamilyBrief,
  getCurrentVersions,
  loadHighValueAtoms
} from '@/lib/server/db'
import type { TenantId } from '@/lib/server/memory/tenant'

/* ================================================================
   Digest Updaters — FamilyBriefUpdater + BoardUpdater（文档 7.5 / 7.6 / 12.1）
   后台写入后链式触发：从记忆/Episode 证据生成 FamilyBrief + BoardSnapshot 并持久化（带 version/evidenceRefs）。
   幂等：content_hash 短路（同证据集重跑不调 LLM、不增版本）；无 key → 提前返回 changed:false（非失败，不进重试）。
   ================================================================ */

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32)
}

export interface EvidenceRef { kind: 'episode' | 'fact' | 'event' | 'memory'; id: string; at?: string; snippet?: string }
interface BriefCore { digestText: string; stablePatterns: string[]; recentChanges: string[]; pendingQuestions: string[] }
interface BoardCore {
  childCurrentState: string
  stableUnderstanding: string[]
  familyInteractionPatterns: string[]
  recentChanges: string[]
  judgmentChanges: string[]
  pendingQuestions: string[]
  currentBestNextStep: string
}
interface EvidenceBundle { refs: EvidenceRef[]; packetSummary: string; contentHash: string }

// 复用 daily 检索包（永读最新）+ 直接捞高价值 FactAtom（孩子原话/材料观察/反证/执行反馈）——
// 此前无 query 调用退化为只吃 daily_updates 文本，材料等原子事实证据进不了 Brief/Board，这里补上。
async function collectEvidence(tenant: TenantId): Promise<EvidenceBundle> {
  const [p, atoms] = await Promise.all([
    buildDailyDialogueRetrievalPacket(undefined, tenant),
    loadHighValueAtoms(tenant.familyId, tenant.childId, 8).catch(() => [])
  ])
  const refs: EvidenceRef[] = [
    ...p.supportingEvidence.map((s) => ({ kind: 'fact' as const, id: `ev_${sha(s)}`, snippet: s.slice(0, 120) })),
    ...p.recentRelatedEvents.map((s) => ({ kind: 'event' as const, id: `evt_${sha(s)}`, snippet: s.slice(0, 120) })),
    ...atoms.map((a) => ({ kind: 'fact' as const, id: `atom_${sha(a.content)}`, snippet: a.content.slice(0, 120) }))
  ]
  const highValueFactTexts = atoms.map(a => a.content)
  const packetSummary = [
    p.relevantChildStructureModels.length ? `画像：${p.relevantChildStructureModels.join('；')}` : '',
    highValueFactTexts.length ? `高价值事实（原话/材料/反证/反馈）：${highValueFactTexts.join('；')}` : '',
    p.supportingEvidence.length ? `证据：${p.supportingEvidence.join('；')}` : '',
    p.recentRelatedEvents.length ? `近期事件：${p.recentRelatedEvents.join('；')}` : '',
    p.pendingHypotheses.length ? `待验证：${p.pendingHypotheses.join('；')}` : ''
  ].filter(Boolean).join('\n')
  const contentHash = sha(refs.map(r => r.id).sort().join('|') + '||' + packetSummary)
  return { refs, packetSummary, contentHash }
}

// digest_update job 入口。先 Brief 后 Board，version/updatedAt/evidenceRefs 由服务端补（不让 LLM 编版本号）。
export async function rebuildBriefAndBoard(tenant: TenantId): Promise<{ briefVersion: number; boardVersion: number; changed: boolean }> {
  const ev = await collectEvidence(tenant)

  // 空证据（新家庭）：无可生成，跳过。
  if (!ev.packetSummary.trim()) {
    return { ...(await getCurrentVersions(tenant.familyId, tenant.childId)), changed: false }
  }

  // L1 内容指纹短路：同证据集重跑 → 连 LLM 都不调，零副作用。
  const existing = await getLatestBoardHash(tenant.familyId, tenant.childId).catch(() => undefined)
  if (existing && existing === ev.contentHash) {
    return { ...(await getCurrentVersions(tenant.familyId, tenant.childId)), changed: false }
  }

  // 无 key / LLM 失败 → callAgentJson 返回 undefined → 提前返回 changed:false（非失败，board/route 走 FALLBACK）。
  const briefAi = await callAgentJson<BriefCore>(
    'familyBriefUpdater',
    '基于以下记忆与 Episode 证据，生成家庭理解简报。',
    { evidence: ev.packetSummary }
  ).catch(() => undefined)
  if (!briefAi?.digestText?.trim()) {
    return { ...(await getCurrentVersions(tenant.familyId, tenant.childId)), changed: false }
  }

  const boardAi = await callAgentJson<BoardCore>(
    'boardUpdater',
    '基于 brief 与证据生成家长可见的家庭支持看板（五段式）。',
    { brief: briefAi, evidence: ev.packetSummary }
  ).catch(() => undefined)
  if (!boardAi?.childCurrentState?.trim()) {
    return { ...(await getCurrentVersions(tenant.familyId, tenant.childId)), changed: false }
  }

  const nowIso = new Date().toISOString()
  const briefVersion = await upsertFamilyBrief(
    tenant.familyId, tenant.childId,
    { ...briefAi, evidenceRefs: ev.refs, updatedAt: nowIso }, ev.refs, ev.contentHash
  )
  const boardVersion = await insertBoardSnapshot(
    tenant.familyId, tenant.childId, boardAi, ev.refs, ev.contentHash
  )
  return { briefVersion: briefVersion ?? 0, boardVersion: boardVersion ?? 0, changed: true }
}

import 'server-only'

import { createHash } from 'node:crypto'
import type { TenantId } from '@/lib/server/memory/tenant'
import {
  getGrowthTrajectorySnapshot,
  getUserTasks,
  getDailyInteractionUpdates,
  listTurnEvents,
} from '@/lib/server/memory/database-manager'
import { listHighValueAtomsForTenant } from '@/lib/server/db'
import { loadDailyUiSnapshot } from '@/lib/server/profile/daily-refresh-agent'
import { loadHandbookCandidatesForWeek, loadAllHandbookCandidates } from '@/lib/server/profile/handbook-candidates-store'
import {
  handbookPageId,
  loadAllHandbookPages,
  loadHandbookPagesForRollingWindow,
  loadHandbookPagesForWeek,
} from '@/lib/server/profile/handbook-pages-store'
import {
  handbookPageToFeedItem,
} from '@/lib/profile/handbook-feed-map'
import {
  getRollingWindowKey,
  isDateInRollingWindow,
} from '@/lib/server/profile/rolling-window'
import { getWeekKey, isDateInWeekKey } from '@/lib/server/profile/week-utils'
import type {
  HandbookAdmissionSource,
  HandbookPage,
  MemoryFeedItem,
  MemoryFeedType,
} from '@/types/handbook-pack'
import { normalizeHighlightsInput } from '@/types/highlight-moment'
import {
  shouldSkipHandbookAdmission,
  type HandbookQualityMeta,
} from '@/lib/server/profile/handbook-quality-gate'

function short(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).replace(/[，,。：:；;]$/, '')}…`
}

function keywordFromText(text: string): string {
  const q = text.match(/[「『"]([^」』"]{2,12})[」』"]/)
  if (q?.[1]) return q[1]
  const t = text.trim()
  if (t.length <= 8) return t
  return short(t, 8)
}

function isRehearsalMode(mode: string): boolean {
  return /rehearsal|预演|communication_rehearsal/i.test(mode)
}

export type AdmissionCandidate = {
  source: HandbookAdmissionSource
  sourceRef: string
  occurredAt: string
  rawEvidence: string
  evidenceRef?: string
  titleHint?: string
  contextSummary?: string
}

function pushGated(
  items: AdmissionCandidate[],
  seen: Set<string>,
  c: AdmissionCandidate,
  meta: HandbookQualityMeta = {}
) {
  const k = `${c.source}:${c.sourceRef}`
  if (seen.has(k)) return
  if (shouldSkipHandbookAdmission(c.source, c.rawEvidence, meta)) return
  seen.add(k)
  items.push(c)
}

/** 扫描近7天可准入手账的候选（代码化矩阵，非 LLM 决定进不进） */
export async function scanHandbookAdmissionCandidates(
  tenant: TenantId,
  windowKey = getRollingWindowKey()
): Promise<AdmissionCandidate[]> {
  const ref = new Date()
  const [turns, trajectory, tasks, uiSnap, atoms, pending] = await Promise.all([
    listTurnEvents(tenant, 120),
    getGrowthTrajectorySnapshot(tenant),
    getUserTasks(tenant),
    loadDailyUiSnapshot(tenant),
    listHighValueAtomsForTenant(tenant.familyId, tenant.childId, 200),
    loadHandbookCandidatesForWeek(tenant, windowKey),
  ])

  const items: AdmissionCandidate[] = []
  const seen = new Set<string>()

  const inWindow = (iso: string) => isDateInRollingWindow(iso, ref, 7)

  for (const turn of turns) {
    if (!inWindow(turn.createdAt)) continue
    if (!isRehearsalMode(turn.mode || '')) continue
    const text = turn.userMessage?.trim()
    if (!text) continue
    pushGated(items, seen, {
      source: 'rehearsal_voice',
      sourceRef: turn.traceId,
      occurredAt: turn.createdAt,
      rawEvidence: text,
      evidenceRef: turn.traceId,
      titleHint: '冲突语音',
    })
  }

  for (const c of pending) {
    pushGated(items, seen, {
      source: c.source,
      sourceRef: c.sourceRef,
      occurredAt: c.occurredAt,
      rawEvidence: c.rawEvidence,
      evidenceRef: c.sourceRef,
      titleHint: c.contextSummary || c.source,
      contextSummary: c.contextSummary,
    })
  }

  for (const task of tasks) {
    const fb = task.feedback
    if (!fb?.completed && !fb?.effect && !fb?.reaction) continue
    const ts = task.updatedAt || task.createdAt
    if (!inWindow(ts)) continue
    const effect = (fb.effect || '').trim()
    const completed = (fb.completed || '').trim()
    const positive = /自己|主动|愿意|完成|顺/.test(`${completed}${effect}${fb.reaction || ''}`)
    if (!positive) continue
    pushGated(
      items,
      seen,
      {
        source: 'task_shine',
        sourceRef: task.taskId,
        occurredAt: ts,
        rawEvidence: effect || completed,
        evidenceRef: task.taskId,
        titleHint: task.title,
        contextSummary: task.title,
      },
      { taskEffect: effect, taskCompleted: completed }
    )
  }

  const highlights = normalizeHighlightsInput(
    (uiSnap as { highlightMoments?: unknown; highlights?: unknown })?.highlightMoments ||
      uiSnap?.highlights
  )
  for (const hl of highlights) {
    const ts = hl.occurredAt || new Date().toISOString()
    if (!inWindow(ts)) continue
    pushGated(items, seen, {
      source: 'highlight_moment',
      sourceRef: hl.id || hl.title,
      occurredAt: ts,
      rawEvidence: hl.teaser || hl.title,
      evidenceRef: hl.sourceRef,
      titleHint: hl.title,
      contextSummary: hl.whyHighlighted,
    })
  }

  for (const entry of trajectory?.entries || []) {
    if (!inWindow(entry.occurredAt)) continue
    const raw = (entry.summary || entry.title || '').trim()
    pushGated(items, seen, {
      source: 'trajectory_hard',
      sourceRef: entry.entryId || entry.title,
      occurredAt: entry.occurredAt,
      rawEvidence: raw,
      evidenceRef: entry.entryId || entry.title,
      titleHint: entry.title,
      contextSummary: entry.summary,
    })
  }

  for (const atom of atoms) {
    if (!inWindow(atom.occurredAt)) continue
    pushGated(
      items,
      seen,
      {
        source: 'episode_atom',
        sourceRef: atom.atomId,
        occurredAt: atom.occurredAt,
        rawEvidence: atom.content,
        evidenceRef: atom.sourceEventId || atom.episodeId,
        titleHint: keywordFromText(atom.content),
      },
      { atomSourceType: atom.sourceType }
    )
  }

  const journals = await getDailyInteractionUpdates(tenant)
  for (const j of journals) {
    if (j.sourceKind !== 'journal') continue
    const ts = j.createdAt || j.timestamp
    if (!inWindow(ts)) continue
    const text = j.newInput?.trim()
    if (!text) continue
    pushGated(items, seen, {
      source: 'journal',
      sourceRef: j.updateId,
      occurredAt: ts,
      rawEvidence: text,
      evidenceRef: j.sourceEventId || j.updateId,
      titleHint: '随笔',
    })
  }

  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  return items
}

const HISTORICAL_TURN_LIMIT = 500
const HISTORICAL_ATOM_LIMIT = 500

/** 扫描全历史准入候选（回填 job 用，不限 weekKey） */
export async function scanHandbookAdmissionCandidatesAllTime(
  tenant: TenantId
): Promise<AdmissionCandidate[]> {
  const [turns, trajectory, tasks, uiSnap, atoms, pending, journals] = await Promise.all([
    listTurnEvents(tenant, HISTORICAL_TURN_LIMIT),
    getGrowthTrajectorySnapshot(tenant),
    getUserTasks(tenant),
    loadDailyUiSnapshot(tenant),
    listHighValueAtomsForTenant(tenant.familyId, tenant.childId, HISTORICAL_ATOM_LIMIT),
    loadAllHandbookCandidates(tenant),
    getDailyInteractionUpdates(tenant),
  ])

  const items: AdmissionCandidate[] = []
  const seen = new Set<string>()

  for (const turn of turns) {
    if (!isRehearsalMode(turn.mode || '')) continue
    const text = turn.userMessage?.trim()
    if (!text) continue
    pushGated(items, seen, {
      source: 'rehearsal_voice',
      sourceRef: turn.traceId,
      occurredAt: turn.createdAt,
      rawEvidence: text,
      evidenceRef: turn.traceId,
      titleHint: '冲突语音',
    })
  }

  for (const c of pending) {
    pushGated(items, seen, {
      source: c.source,
      sourceRef: c.sourceRef,
      occurredAt: c.occurredAt,
      rawEvidence: c.rawEvidence,
      evidenceRef: c.sourceRef,
      titleHint: c.contextSummary || c.source,
      contextSummary: c.contextSummary,
    })
  }

  for (const task of tasks) {
    const fb = task.feedback
    if (!fb?.completed && !fb?.effect && !fb?.reaction) continue
    const ts = task.updatedAt || task.createdAt
    const effect = (fb.effect || '').trim()
    const completed = (fb.completed || '').trim()
    const positive = /自己|主动|愿意|完成|顺/.test(`${completed}${effect}${fb.reaction || ''}`)
    if (!positive) continue
    pushGated(
      items,
      seen,
      {
        source: 'task_shine',
        sourceRef: task.taskId,
        occurredAt: ts,
        rawEvidence: effect || completed,
        evidenceRef: task.taskId,
        titleHint: task.title,
        contextSummary: task.title,
      },
      { taskEffect: effect, taskCompleted: completed }
    )
  }

  const highlights = normalizeHighlightsInput(
    (uiSnap as { highlightMoments?: unknown; highlights?: unknown })?.highlightMoments ||
      uiSnap?.highlights
  )
  for (const hl of highlights) {
    const ts = hl.occurredAt || new Date().toISOString()
    pushGated(items, seen, {
      source: 'highlight_moment',
      sourceRef: hl.id || hl.title,
      occurredAt: ts,
      rawEvidence: hl.teaser || hl.title,
      evidenceRef: hl.sourceRef,
      titleHint: hl.title,
      contextSummary: hl.whyHighlighted,
    })
  }

  for (const entry of trajectory?.entries || []) {
    const raw = (entry.summary || entry.title || '').trim()
    pushGated(items, seen, {
      source: 'trajectory_hard',
      sourceRef: entry.entryId || entry.title,
      occurredAt: entry.occurredAt,
      rawEvidence: raw,
      evidenceRef: entry.entryId || entry.title,
      titleHint: entry.title,
      contextSummary: entry.summary,
    })
  }

  for (const atom of atoms) {
    pushGated(
      items,
      seen,
      {
        source: 'episode_atom',
        sourceRef: atom.atomId,
        occurredAt: atom.occurredAt,
        rawEvidence: atom.content,
        evidenceRef: atom.sourceEventId || atom.episodeId,
        titleHint: keywordFromText(atom.content),
      },
      { atomSourceType: atom.sourceType }
    )
  }

  for (const j of journals) {
    if (j.sourceKind !== 'journal') continue
    const ts = j.createdAt || j.timestamp
    const text = j.newInput?.trim()
    if (!text) continue
    pushGated(items, seen, {
      source: 'journal',
      sourceRef: j.updateId,
      occurredAt: ts,
      rawEvidence: text,
      evidenceRef: j.sourceEventId || j.updateId,
      titleHint: '随笔',
    })
  }

  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  return items
}

function fallbackDisplayLine(raw: string): string {
  const t = raw.trim()
  if (t.length <= 24) return t
  return short(t, 22)
}

export type HandbookPageWithMeta = HandbookPage & { rawFallback?: string; titleHint?: string }

/** 准入新页：已有 pageId 则 skip（幂等）；weekKey 按 occurredAt 派生 */
export async function admitHandbookCandidatesFromList(
  tenant: TenantId,
  candidates: AdmissionCandidate[]
): Promise<HandbookPageWithMeta[]> {
  const existing = await loadAllHandbookPages(tenant)
  const existingIds = new Set(existing.map((p) => p.pageId))
  const admitted: HandbookPageWithMeta[] = []

  for (const c of candidates) {
    const pageId = handbookPageId(c.source, c.sourceRef)
    if (existingIds.has(pageId)) continue
    const weekKey = getRollingWindowKey(new Date(c.occurredAt))
    const page: HandbookPageWithMeta = {
      pageId,
      source: c.source,
      sourceRef: c.sourceRef,
      occurredAt: c.occurredAt,
      displayLine: fallbackDisplayLine(c.rawEvidence),
      rawEvidence: c.rawEvidence,
      contextSummary: c.contextSummary,
      titleHint: c.titleHint,
      weekKey,
      polished: false,
      evidenceRef: c.evidenceRef,
      rawFallback: c.rawEvidence,
    }
    admitted.push(page)
    existingIds.add(pageId)
  }

  return admitted
}

/** 准入新页：已有 pageId 则 skip（幂等） */
export async function admitHandbookCandidates(
  tenant: TenantId,
  windowKey = getRollingWindowKey()
): Promise<HandbookPageWithMeta[]> {
  const candidates = await scanHandbookAdmissionCandidates(tenant, windowKey)
  return admitHandbookCandidatesFromList(tenant, candidates)
}

export async function buildMemoryFeedForWeek(
  tenant: TenantId,
  weekKey = getWeekKey()
): Promise<MemoryFeedItem[]> {
  const pages = await loadHandbookPagesForWeek(tenant, weekKey)
  return pages.map(handbookPageToFeedItem)
}

/** 近7天滚动窗口记忆 feed */
export async function buildMemoryFeedForRollingWindow(
  tenant: TenantId,
  days = 7,
  ref = new Date()
): Promise<MemoryFeedItem[]> {
  const pages = await loadHandbookPagesForRollingWindow(tenant, days, ref)
  return pages.map(handbookPageToFeedItem)
}

/** 手账记忆列表：全历史准入页，按时间倒序（不限本周） */
export async function buildMemoryFeedAll(
  tenant: TenantId,
  limit = 200
): Promise<MemoryFeedItem[]> {
  const pages = await loadAllHandbookPages(tenant)
  return pages
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, limit)
    .map(handbookPageToFeedItem)
}

export function memoryFeedContentHash(items: MemoryFeedItem[]): string {
  const payload = items.map((i) => `${i.id}|${i.displayLine || i.snippet}`).join('\n')
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

export async function computePageMetrics(tenant: TenantId, ref = new Date()) {
  const [allPages, recentPages] = await Promise.all([
    loadAllHandbookPages(tenant),
    loadHandbookPagesForRollingWindow(tenant, 7, ref),
  ])
  return {
    pageCount: allPages.length,
    weekPageDelta: recentPages.length,
    weekBreakdown: recentPages.slice(0, 5).map((p) => {
      const feed = handbookPageToFeedItem(p)
      return `${new Date(p.occurredAt).getMonth() + 1}月${new Date(p.occurredAt).getDate()}日 · ${feed.displayLine || feed.keyword}（${feedTypeLabel(feed.type)}）`
    }),
  }
}

export function feedTypeLabel(type: MemoryFeedType): string {
  switch (type) {
    case 'voice':
      return '语音'
    case 'diary':
      return '随笔'
    case 'shine':
      return '亮点'
    case 'hard':
      return '难题'
    default:
      return '记忆'
  }
}

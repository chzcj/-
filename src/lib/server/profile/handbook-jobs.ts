import 'server-only'

import type { TenantId } from '@/lib/server/memory/tenant'
import {
  admitHandbookCandidates,
  admitHandbookCandidatesFromList,
  buildMemoryFeedAll,
  scanHandbookAdmissionCandidatesAllTime,
  type HandbookPageWithMeta,
} from '@/lib/server/profile/handbook-admission'
import { polishHandbookLine } from '@/lib/server/profile/handbook-line-editor'
import { isBadHandbookPage } from '@/lib/server/profile/handbook-quality-gate'
import {
  deleteHandbookPages,
  loadAllHandbookPages,
  loadHandbookPagesForWeek,
  saveHandbookPage,
  saveHandbookPages,
} from '@/lib/server/profile/handbook-pages-store'
import { saveMemoryFeedSnapshot } from '@/lib/server/profile/handbook-store'
import { runWeeklyHandbookUpdate } from '@/lib/server/profile/handbook-synthesizer'
import { runTimeCapsuleUpdate } from '@/lib/server/profile/time-capsule'
import { getRollingWindowKey } from '@/lib/server/profile/rolling-window'
import { listTurnEvents } from '@/lib/server/memory/database-manager'
import type { HandbookPage } from '@/types/handbook-pack'

async function polishAndSaveNewPages(
  tenant: TenantId,
  pages: HandbookPageWithMeta[]
): Promise<{ saved: number; skippedNoEvidence: number; skippedUnpolishable: number }> {
  let saved = 0
  let skippedNoEvidence = 0
  let skippedUnpolishable = 0
  for (const page of pages) {
    const raw = page.rawEvidence || page.rawFallback || ''
    if (!raw.trim()) {
      skippedNoEvidence++
      continue
    }
    const polished = await polishHandbookLine({
      source: page.source,
      rawEvidence: raw,
      titleHint: page.titleHint,
      contextSummary: page.contextSummary,
      occurredAt: page.occurredAt,
    })
    if (!polished.accepted) {
      skippedUnpolishable++
      console.info('[handbook-jobs] skip unpolishable page', page.pageId)
      continue
    }
    const stored: HandbookPage = {
      pageId: page.pageId,
      source: page.source,
      sourceRef: page.sourceRef,
      occurredAt: page.occurredAt,
      displayLine: polished.displayLine,
      teaser: polished.teaser,
      whyIncluded: polished.whyIncluded,
      rawEvidence: raw,
      contextSummary: page.contextSummary,
      titleHint: page.titleHint,
      evidenceRef: page.evidenceRef,
      weekKey: page.weekKey,
      polished: true,
    }
    await saveHandbookPage(tenant, stored)
    saved++
  }
  return { saved, skippedNoEvidence, skippedUnpolishable }
}

/** 润色尚未 polished 的页（幂等） */
async function polishUnpolishedPages(tenant: TenantId, weekKey?: string): Promise<number> {
  const all = weekKey
    ? await loadHandbookPagesForWeek(tenant, weekKey)
    : await loadAllHandbookPages(tenant)
  const pending = all.filter((p) => !p.polished || !p.displayLine?.trim() || !p.whyIncluded?.trim())
  if (!pending.length) return 0

  const updated: HandbookPage[] = []
  for (const page of pending) {
    const raw = page.rawEvidence?.trim()
    if (!raw) continue
    const polished = await polishHandbookLine({
      source: page.source,
      rawEvidence: raw,
      titleHint: page.titleHint,
      contextSummary: page.contextSummary,
      occurredAt: page.occurredAt,
    })
    if (!polished.accepted) {
      await deleteHandbookPages(tenant, [page.pageId]).catch(() => 0)
      continue
    }
    updated.push({
      ...page,
      displayLine: polished.displayLine,
      teaser: polished.teaser || page.teaser,
      whyIncluded: polished.whyIncluded || page.whyIncluded,
      rawEvidence: raw,
      polished: true,
    })
  }
  if (updated.length) await saveHandbookPages(tenant, updated)
  return updated.length
}

export async function runHandbookPurgeBadPages(tenant: TenantId): Promise<number> {
  const pages = await loadAllHandbookPages(tenant)
  const badIds = pages
    .filter((p) => isBadHandbookPage(p.displayLine, p.rawEvidence, p.source))
    .map((p) => p.pageId)
  if (!badIds.length) return 0
  return deleteHandbookPages(tenant, badIds)
}

export async function runHandbookPageAdmit(tenant: TenantId): Promise<number> {
  const weekKey = getRollingWindowKey()
  const newPages = await admitHandbookCandidates(tenant, weekKey)
  const polishStats = newPages.length ? await polishAndSaveNewPages(tenant, newPages) : null
  const admitted = polishStats?.saved ?? 0
  await polishUnpolishedPages(tenant, weekKey).catch(() => 0)
  return admitted
}

export async function runFamilyMemoryFeedRebuild(tenant: TenantId): Promise<number> {
  const weekKey = getRollingWindowKey()
  await runHandbookPageAdmit(tenant)
  const items = await buildMemoryFeedAll(tenant)
  await saveMemoryFeedSnapshot(tenant, weekKey, items)
  return items.length
}

export async function runHandbookChain(tenant: TenantId): Promise<void> {
  await runFamilyMemoryFeedRebuild(tenant)
  const handbook = await runWeeklyHandbookUpdate(tenant)
  if (handbook?.source === 'llm') {
    await runTimeCapsuleUpdate(tenant).catch((err) =>
      console.warn('[handbook-chain] time capsule failed:', err)
    )
  }
}

export function handbookJobKey(tenant: TenantId, weekKey = getRollingWindowKey()) {
  return `handbook:${tenant.familyId}:${tenant.childId}:${weekKey}`
}

export function memoryFeedJobKey(tenant: TenantId, weekKey = getRollingWindowKey()) {
  return `memory_feed:${tenant.familyId}:${tenant.childId}:${weekKey}`
}

export function handbookPageAdmitJobKey(tenant: TenantId, weekKey = getRollingWindowKey()) {
  return `handbook_admit:${tenant.familyId}:${tenant.childId}:${weekKey}`
}

export function handbookBackfillJobKey(tenant: TenantId) {
  return `handbook_backfill:${tenant.familyId}:${tenant.childId}`
}

export function handbookPurgeJobKey(tenant: TenantId) {
  return `handbook_purge:${tenant.familyId}:${tenant.childId}`
}

export function handbookRefreshJobKey(tenant: TenantId) {
  return `handbook_refresh:${tenant.familyId}:${tenant.childId}`
}

/** 一次性历史回填：purge → 扫描全历史 → 准入 → 润色 → feed 快照 */
export async function runHandbookHistoricalBackfill(tenant: TenantId): Promise<{
  purged: number
  candidates: number
  admitted: number
  polished: number
  skippedNoEvidence: number
  skippedUnpolishable: number
}> {
  const purged = await runHandbookPurgeBadPages(tenant)
  const candidates = await scanHandbookAdmissionCandidatesAllTime(tenant)
  const newPages = await admitHandbookCandidatesFromList(tenant, candidates)
  const polishStats = newPages.length ? await polishAndSaveNewPages(tenant, newPages) : null
  const admitted = polishStats?.saved ?? 0

  const weekKey = getRollingWindowKey()
  await polishUnpolishedPages(tenant).catch(() => 0)
  const items = await buildMemoryFeedAll(tenant)
  await saveMemoryFeedSnapshot(tenant, weekKey, items)

  const stats = {
    purged,
    candidates: candidates.length,
    admitted,
    polished: admitted,
    skippedNoEvidence: polishStats?.skippedNoEvidence ?? 0,
    skippedUnpolishable: polishStats?.skippedUnpolishable ?? 0,
  }
  console.info('[handbook-jobs] historical backfill done', tenant.familyId, stats)
  return stats
}

export async function runHandbookFullRefresh(tenant: TenantId): Promise<void> {
  await runHandbookPurgeBadPages(tenant)
  await runHandbookHistoricalBackfill(tenant)
  await runHandbookChain(tenant)
}

/** 健康检测：是否应触发全量刷新 */
export async function evaluateHandbookHealth(tenant: TenantId): Promise<{
  needsRefresh: boolean
  reason: string
  badRatio: number
  pageCount: number
}> {
  const [pages, turns] = await Promise.all([
    loadAllHandbookPages(tenant),
    listTurnEvents(tenant, 20),
  ])
  const pageCount = pages.length
  const badCount = pages.filter((p) =>
    isBadHandbookPage(p.displayLine, p.rawEvidence, p.source)
  ).length
  const badRatio = pageCount ? badCount / pageCount : 0
  const emptyTeaserRatio =
    pageCount === 0
      ? 1
      : pages.filter((p) => !p.teaser?.trim() || p.teaser === p.displayLine).length / pageCount

  if (pageCount === 0 && turns.length > 0) {
    return { needsRefresh: true, reason: 'empty_with_turns', badRatio, pageCount }
  }
  if (badRatio > 0.3) {
    return { needsRefresh: true, reason: 'bad_ratio', badRatio, pageCount }
  }
  if (emptyTeaserRatio > 0.5 && pageCount >= 3) {
    return { needsRefresh: true, reason: 'thin_teasers', badRatio, pageCount }
  }
  return { needsRefresh: false, reason: 'ok', badRatio, pageCount }
}

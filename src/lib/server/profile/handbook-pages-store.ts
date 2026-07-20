import 'server-only'

import {
  loadMemoryLayerItemById,
  loadMemoryLayerItemsByIdPrefix,
  upsertMemoryLayerItems,
  deleteMemoryLayerItems,
} from '@/lib/server/db'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { HandbookPage } from '@/types/handbook-pack'
import { isDateInRollingWindow } from '@/lib/server/profile/rolling-window'

const PAGES_LAYER = 'family_handbook_pages'

function pageItemId(pageId: string) {
  return `page:${pageId}`
}

export function handbookPageId(source: string, sourceRef: string) {
  return `${source}:${sourceRef}`
}

export async function loadHandbookPage(
  tenant: TenantId,
  pageId: string
): Promise<HandbookPage | null> {
  return (
    (await loadMemoryLayerItemById<HandbookPage>(
      PAGES_LAYER,
      pageItemId(pageId),
      tenant.familyId,
      tenant.childId
    )) ?? null
  )
}

export async function loadAllHandbookPages(tenant: TenantId): Promise<HandbookPage[]> {
  const rows =
    (await loadMemoryLayerItemsByIdPrefix<HandbookPage>(
      PAGES_LAYER,
      'page:',
      tenant.familyId,
      tenant.childId
    ).catch(() => [])) ?? []
  return rows.filter((p) => p.pageId && p.source && p.occurredAt)
}

export async function loadHandbookPagesForWeek(
  tenant: TenantId,
  weekKey: string
): Promise<HandbookPage[]> {
  const all = await loadAllHandbookPages(tenant)
  return all
    .filter((p) => p.weekKey === weekKey)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

/** 近 N 天滚动窗口（按 occurredAt，兼容旧 ISO weekKey 页） */
export async function loadHandbookPagesForRollingWindow(
  tenant: TenantId,
  days = 7,
  ref = new Date()
): Promise<HandbookPage[]> {
  const all = await loadAllHandbookPages(tenant)
  return all
    .filter((p) => isDateInRollingWindow(p.occurredAt, ref, days))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

export async function countLifetimeHandbookPages(tenant: TenantId): Promise<number> {
  const all = await loadAllHandbookPages(tenant)
  return all.length
}

export async function saveHandbookPage(tenant: TenantId, page: HandbookPage): Promise<void> {
  await upsertMemoryLayerItems(
    PAGES_LAYER,
    [
      {
        itemId: pageItemId(page.pageId),
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: page,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

export async function saveHandbookPages(tenant: TenantId, pages: HandbookPage[]): Promise<void> {
  if (!pages.length) return
  await upsertMemoryLayerItems(
    PAGES_LAYER,
    pages.map((page) => ({
      itemId: pageItemId(page.pageId),
      familyId: tenant.familyId,
      childId: tenant.childId,
      data: page,
    })),
    tenant.familyId,
    tenant.childId
  )
}

export async function deleteHandbookPages(tenant: TenantId, pageIds: string[]): Promise<number> {
  if (!pageIds.length) return 0
  const itemIds = pageIds.map((id) => pageItemId(id))
  return (
    (await deleteMemoryLayerItems(
      PAGES_LAYER,
      itemIds,
      tenant.familyId,
      tenant.childId
    )) ?? 0
  )
}

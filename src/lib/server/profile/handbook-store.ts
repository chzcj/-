import 'server-only'

import { loadMemoryLayerItemById, upsertMemoryLayerItems } from '@/lib/server/db'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { MemoryFeedItem, TimeCapsuleSnapshot, WeeklyHandbook } from '@/types/handbook-pack'

const HANDBOOK_LAYER = 'family_handbook_snapshot'
const FEED_LAYER = 'family_memory_feed'
const CAPSULE_LAYER = 'time_capsule_snapshot'

function handbookItemId(weekKey: string) {
  return `week:${weekKey}`
}

export async function loadWeeklyHandbook(
  tenant: TenantId,
  weekKey: string
): Promise<WeeklyHandbook | null> {
  return (
    (await loadMemoryLayerItemById<WeeklyHandbook>(
      HANDBOOK_LAYER,
      handbookItemId(weekKey),
      tenant.familyId,
      tenant.childId
    )) ?? null
  )
}

export async function saveWeeklyHandbook(
  tenant: TenantId,
  handbook: WeeklyHandbook
): Promise<void> {
  await upsertMemoryLayerItems(
    HANDBOOK_LAYER,
    [
      {
        itemId: handbookItemId(handbook.weekKey),
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: handbook,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

export async function loadMemoryFeedSnapshot(
  tenant: TenantId,
  weekKey: string
): Promise<MemoryFeedItem[] | null> {
  return (
    (await loadMemoryLayerItemById<{ items: MemoryFeedItem[] }>(
      FEED_LAYER,
      handbookItemId(weekKey),
      tenant.familyId,
      tenant.childId
    ))?.items ?? null
  )
}

export async function saveMemoryFeedSnapshot(
  tenant: TenantId,
  weekKey: string,
  items: MemoryFeedItem[]
): Promise<void> {
  await upsertMemoryLayerItems(
    FEED_LAYER,
    [
      {
        itemId: handbookItemId(weekKey),
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: { items, refreshedAt: new Date().toISOString() },
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

export async function loadTimeCapsuleSnapshot(
  tenant: TenantId
): Promise<TimeCapsuleSnapshot | null> {
  return (
    (await loadMemoryLayerItemById<TimeCapsuleSnapshot>(
      CAPSULE_LAYER,
      'latest',
      tenant.familyId,
      tenant.childId
    )) ?? null
  )
}

export async function saveTimeCapsuleSnapshot(
  tenant: TenantId,
  snapshot: TimeCapsuleSnapshot
): Promise<void> {
  await upsertMemoryLayerItems(
    CAPSULE_LAYER,
    [
      {
        itemId: 'latest',
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: snapshot,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

export async function listHandbookArchiveWeeks(
  tenant: TenantId,
  limit = 4
): Promise<Array<{ weekLabel: string; handbookId: string }>> {
  const { loadMemoryLayerItemsByIdPrefix } = await import('@/lib/server/db')
  const rows =
    (await loadMemoryLayerItemsByIdPrefix<WeeklyHandbook>(
      HANDBOOK_LAYER,
      'week:',
      tenant.familyId,
      tenant.childId
    ).catch(() => [])) ?? []
  return rows
    .filter((h) => h.weekKey && h.weekRangeLabel)
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    .slice(0, limit)
    .map((h) => ({ weekLabel: h.weekRangeLabel, handbookId: h.weekKey }))
}

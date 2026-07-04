import 'server-only'

import type { DailyDialogueRetrievalPacket } from '@/types/database'
import type { TenantId } from '@/lib/server/memory/tenant'
import { getMergedParentInputHistory } from '@/lib/server/memory/database-manager'

const TTL_MS = 30 * 60 * 1000

type CacheEntry = {
  packet: DailyDialogueRetrievalPacket
  at: number
}

const g = globalThis as typeof globalThis & {
  __childosRetrievalCache?: Map<string, CacheEntry>
}

function cacheKey(tenant: TenantId): string {
  return `${tenant.familyId}:${tenant.childId}`
}

export function getCachedRetrievalPacket(tenant: TenantId): DailyDialogueRetrievalPacket | undefined {
  const entry = g.__childosRetrievalCache?.get(cacheKey(tenant))
  if (!entry) return undefined
  if (Date.now() - entry.at > TTL_MS) {
    g.__childosRetrievalCache?.delete(cacheKey(tenant))
    return undefined
  }
  return entry.packet
}

export function setCachedRetrievalPacket(tenant: TenantId, packet: DailyDialogueRetrievalPacket): void {
  if (!g.__childosRetrievalCache) g.__childosRetrievalCache = new Map()
  g.__childosRetrievalCache.set(cacheKey(tenant), { packet, at: Date.now() })
}

/** 同线程后续轮：复用缓存结构，仅刷新最近家长输入 */
export async function mergeIncrementalRetrievalPacket(
  cached: DailyDialogueRetrievalPacket,
  userText: string,
  tenant: TenantId
): Promise<DailyDialogueRetrievalPacket> {
  const inputHistory = await getMergedParentInputHistory(tenant, 12)
  const recentRelatedEvents = [
    userText.trim(),
    ...inputHistory.map((h) => h.text).filter(Boolean).slice(-5),
  ].filter((v, i, arr) => arr.indexOf(v) === i)

  return {
    ...cached,
    recentRelatedEvents,
    recommendedHandling: { ...cached.recommendedHandling },
  }
}

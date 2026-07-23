import 'server-only'

import type { DailyDialogueRetrievalPacket } from '@/types/database'
import type { TenantId } from '@/lib/server/memory/tenant'
import { getMergedParentInputHistory } from '@/lib/server/memory/database-manager'
import { embedText, isEmbeddingEnabled } from '@/lib/server/memory/embedding'

const TTL_MS = 30 * 60 * 1000
/** 主题漂移阈值：cos sim < 此值则判定话题切换，失效 cache */
const DRIFT_THRESHOLD = 0.6

type CacheEntry = {
  packet: DailyDialogueRetrievalPacket
  at: number
  queryEmbedding: number[]
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

export function getCachedRetrievalEntry(tenant: TenantId): CacheEntry | undefined {
  const entry = g.__childosRetrievalCache?.get(cacheKey(tenant))
  if (!entry) return undefined
  if (Date.now() - entry.at > TTL_MS) {
    g.__childosRetrievalCache?.delete(cacheKey(tenant))
    return undefined
  }
  return entry
}

export function setCachedRetrievalPacket(
  tenant: TenantId,
  packet: DailyDialogueRetrievalPacket,
  queryEmbedding: number[],
): void {
  if (!g.__childosRetrievalCache) g.__childosRetrievalCache = new Map()
  g.__childosRetrievalCache.set(cacheKey(tenant), { packet, at: Date.now(), queryEmbedding })
}

export function invalidateCachedRetrievalPacket(tenant: TenantId): void {
  g.__childosRetrievalCache?.delete(cacheKey(tenant))
}

/** cos 相似度（1=完全相同，0=正交，-1=相反） */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * 判断本轮 query 是否与缓存的 query 主题漂移。
 * cos sim < DRIFT_THRESHOLD → 话题切换，应失效 cache 做全量检索。
 */
export function isQueryDrifted(cachedEmbedding: number[], currentEmbedding: number[]): boolean {
  const sim = cosineSimilarity(cachedEmbedding, currentEmbedding)
  return sim < DRIFT_THRESHOLD
}

/**
 * 判断是否可以复用 session cache：
 * 1. embedding 可用
 * 2. 有缓存的 queryEmbedding
 * 3. 本轮 query 与缓存 query 的 cos sim >= DRIFT_THRESHOLD
 */
export async function canReuseCache(
  tenant: TenantId,
  currentQuery: string,
): Promise<{ reuse: boolean; cached?: CacheEntry; currentEmbedding?: number[] }> {
  const entry = getCachedRetrievalEntry(tenant)
  if (!entry) return { reuse: false }
  if (!isEmbeddingEnabled()) return { reuse: false }
  try {
    const currentEmbedding = await embedText(currentQuery)
    if (!currentEmbedding) return { reuse: false }
    if (isQueryDrifted(entry.queryEmbedding, currentEmbedding)) {
      return { reuse: false, currentEmbedding }
    }
    return { reuse: true, cached: entry, currentEmbedding }
  } catch {
    return { reuse: false }
  }
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

import 'server-only'

import type { DailyInteractionUpdate } from '@/types/database'
import { loadMemoryLayerItemById, upsertMemoryLayerItems } from '@/lib/server/db'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { buildMemoryWritePlan } from '@/lib/server/memory/write/decision-engine'
import type { TenantId } from '@/lib/server/memory/tenant'

const LAYER = 'pending_daily_writes'
const ITEM_ID = 'buffer'
/** 与 deep_mechanism 10 轮里程碑对齐：满 N 条有效对话统一 memory_write */
export const DAILY_MEMORY_WRITE_BATCH = 10

type PendingEntry = {
  update: DailyInteractionUpdate
  traceId: string
  stagedAt: string
}

type PendingDailyWriteBuffer = {
  entries: PendingEntry[]
  totalFlushed: number
  updatedAt: string
}

const EMPTY: PendingDailyWriteBuffer = {
  entries: [],
  totalFlushed: 0,
  updatedAt: '',
}

async function loadBuffer(tenant: TenantId): Promise<PendingDailyWriteBuffer> {
  const item = await loadMemoryLayerItemById<PendingDailyWriteBuffer>(
    LAYER,
    ITEM_ID,
    tenant.familyId,
    tenant.childId
  ).catch(() => undefined)
  return item ? { ...EMPTY, ...item, entries: item.entries || [] } : { ...EMPTY }
}

async function saveBuffer(tenant: TenantId, buffer: PendingDailyWriteBuffer): Promise<void> {
  await upsertMemoryLayerItems(
    LAYER,
    [
      {
        itemId: ITEM_ID,
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: { ...buffer, updatedAt: new Date().toISOString() },
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

function batchIdempotencyKey(tenant: TenantId, firstTrace: string, lastTrace: string): string {
  return `memory_write_batch:${tenant.familyId}:${tenant.childId}:${firstTrace}:${lastTrace}`
}

/** 将本轮 daily_update 暂存；满 10 条或反证轮立即 flush 为一次 memory_write */
export async function stageDailyUpdateForMemoryWrite(
  tenant: TenantId,
  update: DailyInteractionUpdate,
  traceId: string,
  opts: { forceFlush?: boolean } = {}
): Promise<{ flushed: boolean; pendingCount: number; batchSize: number }> {
  const buffer = await loadBuffer(tenant)
  buffer.entries.push({ update, traceId, stagedAt: new Date().toISOString() })

  const shouldFlush =
    Boolean(opts.forceFlush) || buffer.entries.length >= DAILY_MEMORY_WRITE_BATCH

  if (!shouldFlush) {
    await saveBuffer(tenant, buffer)
    return { flushed: false, pendingCount: buffer.entries.length, batchSize: 0 }
  }

  const entries = buffer.entries
  const firstTrace = entries[0]?.traceId || traceId
  const lastTrace = entries[entries.length - 1]?.traceId || traceId
  const plan = buildMemoryWritePlan({
    tenant,
    dailyUpdates: entries.map((e) => e.update),
    rationale: {
      whyUpdate: `批量沉淀 ${entries.length} 轮有效日常交流`,
      whyNotPromoteSomeItems: '',
      riskOfOvergeneralization: '',
      nextVerificationNeed: '',
    },
  })

  await enqueueJob(
    'memory_write',
    { plan, tenant },
    batchIdempotencyKey(tenant, firstTrace, lastTrace),
    lastTrace
  )

  buffer.entries = []
  buffer.totalFlushed += entries.length
  await saveBuffer(tenant, buffer)

  return { flushed: true, pendingCount: 0, batchSize: entries.length }
}

/** 登录/日开等路径：把未 flush 的 pending 写入（避免只聊几轮就离开导致丢失） */
export async function flushStalePendingDailyWrites(tenant: TenantId): Promise<number> {
  const buffer = await loadBuffer(tenant)
  if (!buffer.entries.length) return 0

  const entries = buffer.entries
  const firstTrace = entries[0].traceId
  const lastTrace = entries[entries.length - 1].traceId
  const plan = buildMemoryWritePlan({
    tenant,
    dailyUpdates: entries.map((e) => e.update),
    rationale: {
      whyUpdate: `补 flush ${entries.length} 轮暂存日常交流`,
      whyNotPromoteSomeItems: '',
      riskOfOvergeneralization: '',
      nextVerificationNeed: '',
    },
  })

  await enqueueJob(
    'memory_write',
    { plan, tenant },
    batchIdempotencyKey(tenant, firstTrace, lastTrace),
    lastTrace
  )

  buffer.entries = []
  buffer.totalFlushed += entries.length
  await saveBuffer(tenant, buffer)
  return entries.length
}

export async function countPendingDailyWrites(tenant: TenantId): Promise<number> {
  const buffer = await loadBuffer(tenant)
  return buffer.entries.length
}

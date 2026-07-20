import 'server-only'

import type { TenantId } from '@/lib/server/memory/tenant'
import { enqueueJob, getJobHealth } from '@/lib/server/jobs/queue'
import {
  evaluateHandbookHealth,
  handbookBackfillJobKey,
  handbookPurgeJobKey,
  handbookRefreshJobKey,
} from '@/lib/server/profile/handbook-jobs'
import { getRollingWindowKey } from '@/lib/server/profile/rolling-window'

const HANDBOOK_JOB_TYPES = [
  'handbook_purge_bad_pages',
  'handbook_backfill',
  'handbook_page_admit',
  'weekly_handbook_update',
  'family_memory_feed_rebuild',
] as const

function handbookJobsInFlight(health: Awaited<ReturnType<typeof getJobHealth>>): boolean {
  if (!health) return false
  for (const jobType of HANDBOOK_JOB_TYPES) {
    const counts = health.byType[jobType]
    if (!counts) continue
    const active = (counts.pending || 0) + (counts.running || 0) + (counts.retrying || 0)
    if (active > 0) return true
  }
  return false
}

/** 画像 Tab / daily-refresh 触发的手账健康检查与全量刷新 */
export async function maybeEnqueueHandbookRefresh(tenant: TenantId): Promise<{
  enqueued: boolean
  reason: string
}> {
  const health = await evaluateHandbookHealth(tenant)
  if (!health.needsRefresh) {
    return { enqueued: false, reason: health.reason }
  }

  const refreshKey = handbookRefreshJobKey(tenant)
  await enqueueJob('handbook_purge_bad_pages', { tenant }, handbookPurgeJobKey(tenant), null).catch(
    () => undefined
  )
  await enqueueJob('handbook_backfill', { tenant }, handbookBackfillJobKey(tenant), null).catch(
    () => undefined
  )
  await enqueueJob(
    'weekly_handbook_update',
    { tenant },
    `${refreshKey}:${getRollingWindowKey()}`,
    null
  ).catch(() => undefined)

  return { enqueued: true, reason: health.reason }
}

/** 仅当手账相关 job 仍在队列/执行中时显示「正在重新整理」 */
export async function isHandbookRefreshing(tenant: TenantId): Promise<boolean> {
  const jobHealth = await getJobHealth(tenant).catch(() => undefined)
  return handbookJobsInFlight(jobHealth)
}

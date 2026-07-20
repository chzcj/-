import 'server-only'

import type { TenantId } from '@/lib/server/memory/tenant'
import { enqueueJob } from '@/lib/server/jobs/queue'
import {
  evaluateHandbookHealth,
  handbookBackfillJobKey,
  handbookPurgeJobKey,
  handbookRefreshJobKey,
} from '@/lib/server/profile/handbook-jobs'
import { getRollingWindowKey } from '@/lib/server/profile/rolling-window'

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

export async function isHandbookRefreshing(tenant: TenantId): Promise<boolean> {
  const health = await evaluateHandbookHealth(tenant)
  return health.needsRefresh
}

import { ok, fail } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { runDailyPortraitRefresh } from '@/lib/server/profile/daily-refresh-agent'
import { enqueueJob, forceLoginJobCheck } from '@/lib/server/jobs/queue'
import { getGrowthTrajectorySourceHash } from '@/lib/server/profile/growth-trajectory'
import { handbookJobKey } from '@/lib/server/profile/handbook-jobs'
import { maybeEnqueueHandbookRefresh } from '@/lib/server/profile/handbook-refresh-orchestrator'
import { getRollingWindowKey } from '@/lib/server/profile/rolling-window'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  try {
    const windowKey = getRollingWindowKey()
    const refreshPromise = runDailyPortraitRefresh(tenant)

    void maybeEnqueueHandbookRefresh(tenant).catch((err) =>
      console.warn('[account/daily-refresh] handbook refresh check failed:', err)
    )

    void getGrowthTrajectorySourceHash(tenant)
      .then((sourceHash) =>
        enqueueJob(
          'growth_trajectory_update',
          { tenant, sourceHash },
          `growth_trajectory:${tenant.familyId}:${tenant.childId}:${sourceHash}`,
          null
        )
      )
      .catch(() => {})

    void enqueueJob(
      'weekly_handbook_update',
      { tenant },
      handbookJobKey(tenant, windowKey),
      null
    ).catch(() => {})

    await forceLoginJobCheck(tenant).catch((err) => {
      console.warn('[account/daily-refresh] 登录补跑 job 失败:', err)
    })
    const snapshot = await refreshPromise
    return ok({ snapshot })
  } catch (error) {
    console.error('[account/daily-refresh] 失败:', error)
    return fail('REFRESH_FAILED', '画像刷新未成功，可稍后再试。', undefined, 500)
  }
}

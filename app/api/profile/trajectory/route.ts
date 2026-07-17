import { ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { getGrowthTrajectorySnapshot } from '@/lib/server/memory/database-manager'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { getGrowthTrajectorySourceHash } from '@/lib/server/profile/growth-trajectory'

export const dynamic = 'force-dynamic'

/** 画像页登录/进入时的轻量增量检测；长整理放到后台 Job。 */
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const tenant = await resolveTenant()
    const [snapshot, sourceHash] = await Promise.all([
      getGrowthTrajectorySnapshot(tenant),
      getGrowthTrajectorySourceHash(tenant),
    ])
    const refreshing = !snapshot || snapshot.sourceHash !== sourceHash
    if (refreshing) {
      await enqueueJob(
        'growth_trajectory_update',
        { tenant, sourceHash },
        `growth_trajectory:${tenant.familyId}:${tenant.childId}:${sourceHash}`,
        null
      )
    }
    return ok({ trajectory: snapshot, refreshing })
  } catch (error) {
    return failFromError(error)
  }
}

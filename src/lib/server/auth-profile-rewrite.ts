import { getLatestBuiltProfileSnapshot } from '@/lib/server/memory/database-manager'
import { enqueueJob, profileRewriteBucketKey } from '@/lib/server/jobs/queue'
import type { TenantId } from '@/lib/server/memory/tenant'

const PROFILE_REWRITE_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000

/** 登录后检查画像是否超过 2 天未更新，是则入队后台重写（静默，不阻塞登录）。 */
export async function maybeEnqueueProfileRewrite(familyId: string, childId: string): Promise<void> {
  try {
    const tenant: TenantId = { familyId, childId }
    const built = await getLatestBuiltProfileSnapshot(tenant)
    if (!built) return
    const ageMs = Date.now() - new Date(built.updatedAt).getTime()
    if (ageMs < PROFILE_REWRITE_INTERVAL_MS) return
    await enqueueJob('profile_rewrite', { tenant }, profileRewriteBucketKey(tenant), null)
  } catch (err) {
    console.error('[auth] 入队 profile_rewrite 失败（不影响登录）', err)
  }
}

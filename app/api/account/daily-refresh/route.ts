import { ok, fail } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { runDailyPortraitRefresh } from '@/lib/server/profile/daily-refresh-agent'
import { forceLoginJobCheck } from '@/lib/server/jobs/queue'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  try {
    // 登录强制检查：重投本租户 failed job + 强制排队 digest/model_review（桶幂等）。
    // 不阻塞展示层刷新：先发起人话刷新，再异步补跑 job。
    const refreshPromise = runDailyPortraitRefresh(tenant)
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

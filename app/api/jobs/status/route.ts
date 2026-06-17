import { NextResponse } from 'next/server'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { getJobHealth } from '@/lib/server/jobs/queue'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'

/* ================================================================
   后台 job 健康度（测评反馈 P2-④ 闭环可观测）。
   按租户返回各 job 状态计数 + 近期失败，让"生成→写入→检索→使用"可验证、失败可见。
   ================================================================ */
export async function GET(request: Request) {
  if (!verifyInternalApi(request)) return authError()
  const tenant = await resolveTenant()
  const health = await getJobHealth(tenant).catch(() => undefined)
  // DB 未启用（health undefined）→ 返回空健康度而非报错。
  return NextResponse.json({
    ok: true,
    data: health || { byType: {}, totals: { pending: 0, running: 0, retrying: 0, succeeded: 0, failed: 0 }, recentFailures: [] }
  })
}

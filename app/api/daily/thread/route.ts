import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { listTurnEvents } from '@/lib/server/memory/database-manager'
import { turnEventsToDailyThread } from '@/lib/server/daily/turn-thread'
import { resolveTenant } from '@/lib/server/memory/tenant'

/** 从 turn_events 恢复最近 N 轮交流（服务器为主数据源） */
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const tenant = await resolveTenant()
  const limit = Math.min(
    30,
    Math.max(1, Number(new URL(request.url).searchParams.get('limit') || 15))
  )

  const events = await listTurnEvents(tenant, limit)
  const turns = turnEventsToDailyThread(events, limit)

  return ok({ turns, source: 'turn_events', roundCount: events.length })
}

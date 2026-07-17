import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { createUserTask, listRecentUserTasks } from '@/lib/server/tasks/task-service'
import { resolveTenant } from '@/lib/server/memory/tenant'

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const { current, history } = await listRecentUserTasks(tenant)
  return ok({ tasks: current, history })
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const source = typeof body.source === 'string' ? body.source.trim() : '交流'
  const sourceTraceId = typeof body.sourceTraceId === 'string' ? body.sourceTraceId.trim() : undefined
  const observation = typeof body.observation === 'string' ? body.observation.trim() : undefined
  const replyExcerpt = typeof body.replyExcerpt === 'string' ? body.replyExcerpt.trim() : undefined

  if (!title) return fail('EMPTY_TITLE', '任务内容不能为空', undefined, 400)

  const tenant = await resolveTenant()
  const task = await createUserTask(tenant, { title, source, sourceTraceId, observation, replyExcerpt })
  return ok({ task })
}

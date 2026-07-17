import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { applyUserTaskFeedback } from '@/lib/server/tasks/task-service'
import { resolveTenant } from '@/lib/server/memory/tenant'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!(await verifyAppApi(request))) return authError()

  const taskId = params.id?.trim()
  if (!taskId) return fail('BAD_REQUEST', '缺少任务 ID', undefined, 400)

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const feedback = body.feedback as Record<string, unknown> | undefined
  const status = typeof body.status === 'string' ? body.status : '已完成'
  const clientFeedbackAt = typeof body.clientFeedbackAt === 'string' ? body.clientFeedbackAt : undefined

  if (!feedback || typeof feedback !== 'object') {
    return fail('BAD_REQUEST', '请提交反馈内容', undefined, 400)
  }

  const tenant = await resolveTenant()
  const updated = await applyUserTaskFeedback(
    tenant,
    taskId,
    {
      completed: typeof feedback.completed === 'string' ? feedback.completed : undefined,
      effect: typeof feedback.effect === 'string' ? feedback.effect : undefined,
      reaction: typeof feedback.reaction === 'string' ? feedback.reaction : undefined,
      note: typeof feedback.note === 'string' ? feedback.note : undefined,
    },
    status,
    clientFeedbackAt
  )

  if (!updated) return fail('NOT_FOUND', '找不到这条任务', undefined, 404)
  return ok({ task: updated })
}

import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { recordDailySectionFeedback } from '@/lib/server/daily/section-feedback'
import { resolveTenant } from '@/lib/server/memory/tenant'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const traceId = typeof body.traceId === 'string' ? body.traceId.trim() : ''
  const kind = body.kind === 'accurate' || body.kind === 'partial' ? body.kind : null
  const sectionIds = Array.isArray(body.sectionIds)
    ? body.sectionIds.filter((id: unknown): id is string => typeof id === 'string')
    : []
  const note = typeof body.note === 'string' ? body.note.trim() : undefined

  if (!traceId) return fail('BAD_REQUEST', '缺少 traceId', undefined, 400)
  if (!kind) return fail('BAD_REQUEST', '请选择反馈类型', undefined, 400)

  const tenant = await resolveTenant()
  const result = await recordDailySectionFeedback({ tenant, traceId, kind, sectionIds, note })

  if (!result.saved) {
    return fail('TURN_NOT_FOUND', '找不到对应这轮交流记录，请回到交流页再试。', undefined, 404)
  }

  return ok({ saved: true, traceId, kind })
}

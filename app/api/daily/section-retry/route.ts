import { ok, fail } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { getTurnEventByTraceId } from '@/lib/server/memory/database-manager'
import { runOrchestrationPipeline, buildDailyCards } from '@/lib/server/orchestration/pipeline'
import { composeDailySections } from '@/lib/server/daily/section-composer'
import { retrySectionCopy } from '@/lib/server/daily/section-buffer'
import type { DailySection } from '@/types/daily-message'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const traceId = typeof body.traceId === 'string' ? body.traceId.trim() : ''
  const sectionId = typeof body.sectionId === 'string' ? body.sectionId.trim() : ''
  const skeleton = body.section as DailySection | undefined

  if (!traceId || !sectionId || !skeleton?.id) {
    return fail('BAD_REQUEST', '缺少 traceId 或 section', undefined, 400)
  }

  const tenant = await resolveTenant()
  const event = await getTurnEventByTraceId(tenant, traceId)
  const userText = event?.userMessage?.trim() || ''
  if (!userText) return fail('TURN_NOT_FOUND', '找不到对应交流记录', undefined, 404)

  const output = await runOrchestrationPipeline({ userText, tenant, warmTurn: true })
  const cards = buildDailyCards(output, userText)
  const skeletons = composeDailySections(output, cards, userText)
  const sk = skeletons.find((s) => s.id === sectionId) || skeleton

  let completed: DailySection | null = null
  await retrySectionCopy(sk, output, userText, {
    onSectionComplete: (section) => {
      completed = section
    },
  })

  if (!completed) {
    return fail('SECTION_RETRY_FAILED', '这部分未生成，请稍后再试', undefined, 502)
  }

  return ok({ section: completed })
}

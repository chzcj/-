import { ok, fail } from '@/lib/api-response'
import { verifyInternalApi } from '@/lib/server/auth-guard'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { handbookBackfillJobKey } from '@/lib/server/profile/handbook-jobs'
import { maybeEnqueueHandbookRefresh } from '@/lib/server/profile/handbook-refresh-orchestrator'
import type { TenantId } from '@/lib/server/memory/tenant'

export const runtime = 'nodejs'

type Body = {
  familyId?: string
  childId?: string
  /** true：purge → backfill → weekly（与画像 Tab orchestrator 一致） */
  fullRefresh?: boolean
}

/** 内部：入队一次性手账历史回填（需 INTERNAL_API_TOKEN） */
export async function POST(request: Request) {
  if (!verifyInternalApi(request)) {
    return fail('UNAUTHORIZED', '需要内部 API token', undefined, 401)
  }

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    return fail('BAD_REQUEST', 'JSON 无效', undefined, 400)
  }

  const familyId = body.familyId?.trim()
  const childId = body.childId?.trim()
  if (!familyId || !childId) {
    return fail('BAD_REQUEST', 'familyId 与 childId 必填', undefined, 400)
  }

  const tenant: TenantId = { familyId, childId }

  if (body.fullRefresh) {
    const result = await maybeEnqueueHandbookRefresh(tenant)
    return ok({ ...result, tenant, mode: 'fullRefresh' })
  }

  const jobKey = handbookBackfillJobKey(tenant)
  await enqueueJob('handbook_backfill', { tenant }, jobKey, null)
  return ok({ enqueued: true, jobKey, tenant, mode: 'backfillOnly' })
}

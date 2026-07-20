import { ok, fail } from '@/lib/api-response'
import { verifyInternalApi } from '@/lib/server/auth-guard'
import { runEpisodeBatchReingest } from '@/lib/server/memory/episode/batch-reingest'
import type { TenantId } from '@/lib/server/memory/tenant'

export const runtime = 'nodejs'

type Body = {
  familyId?: string
  childId?: string
  limit?: number
  dryRun?: boolean
}

/** 内部：批量重跑 episode_ingest（排除寒暄短句；有 LLM 成本） */
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
  const result = await runEpisodeBatchReingest(tenant, {
    limit: body.limit,
    dryRun: body.dryRun,
  })
  return ok({ ...result, tenant, dryRun: Boolean(body.dryRun) })
}

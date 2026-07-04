import { ok, fail } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { getMemoryWriteStatusByTrace } from '@/lib/server/jobs/queue'

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const url = new URL(request.url)
  const traceId = url.searchParams.get('traceId')
  if (!traceId) return fail('BAD_REQUEST', '缺少 traceId', undefined, 400)
  const status = await getMemoryWriteStatusByTrace(traceId)
  if (!status) return ok({ status: null, label: 'unknown' })
  return ok({ status })
}

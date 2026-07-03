import { ok, fail } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { getTurnEventByTraceId } from '@/lib/server/memory/database-manager'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import { enqueueJob } from '@/lib/server/jobs/queue'

export const dynamic = 'force-dynamic'

/* 「深度展开」主动沉淀入口：家长在理解卡页点开深度展开 = 觉得这轮值得深挖。
   用 traceId 取回本轮 userMessage，入队 episode_ingest（含六维深拆，见 episodeExtractor）。
   幂等：episodeId 由 (tenant + sha(text)) 派生，重复点击只写一次。 */
export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const traceId = typeof body?.traceId === 'string' ? body.traceId.trim() : ''
  if (!traceId) return fail('EMPTY_TRACE', '缺少 traceId', undefined, 400)

  const tenant = await resolveTenant()
  const event = await getTurnEventByTraceId(tenant, traceId)
  const text = event?.userMessage?.trim() || ''
  if (!text) return fail('TURN_NOT_FOUND', '找不到这轮对话的原文，无法沉淀。', undefined, 404)

  const episodeId = deriveEpisodeId(text, { familyId: tenant.familyId, childId: tenant.childId })
  await enqueueJob(
    'episode_ingest',
    { text, ctx: { sourceEventId: traceId, familyId: tenant.familyId, childId: tenant.childId, episodeId } },
    episodeId,
    traceId
  )
  // 深拆随深度展开一起跑（低频）：六维拆解 + 保守生成新假设。有新假设 → 链式 memory_write + model_review。
  // 日常交流不再触发 daily_deep（见 daily/stream），仅在此低频入口跑，保质量不烧高频 token。
  void enqueueJob('daily_deep', { text, tenant, traceId }, `daily_deep_${episodeId}`, traceId)

  return ok({ episodeId, enqueued: true })
}

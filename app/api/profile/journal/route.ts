import { ok, fail } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { saveDailyInteractionUpdate } from '@/lib/server/memory/database-manager'
import { buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { memoryFeedJobKey } from '@/lib/server/profile/handbook-jobs'
import { getWeekKey } from '@/lib/server/profile/week-utils'
import type { DailyInteractionUpdate } from '@/types/database'

export const dynamic = 'force-dynamic'

/** 家长随笔：写入 daily_updates（sourceKind=journal）并触发 memory feed 重建 */
export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  let body: { text?: string }
  try {
    body = await request.json()
  } catch {
    return fail('INVALID_BODY', '请求格式无效', undefined, 400)
  }
  const text = body.text?.trim()
  if (!text || text.length < 4) {
    return fail('TEXT_TOO_SHORT', '随笔至少写几个字', undefined, 400)
  }
  if (text.length > 2000) {
    return fail('TEXT_TOO_LONG', '随笔过长，请分段记录', undefined, 400)
  }

  const base = createDailyUpdate(text, 'pure_record', [], tenant)
  const update: DailyInteractionUpdate & { sourceKind?: 'journal' } = {
    ...base,
    sourceKind: 'journal',
  }

  await saveDailyInteractionUpdate(update, tenant)

  const writePlan = buildMemoryWritePlan({
    tenant,
    dailyUpdates: [update],
    rationale: {
      whyUpdate: '家长随笔',
      whyNotPromoteSomeItems: '',
      riskOfOvergeneralization: '',
      nextVerificationNeed: '',
    },
  })
  void enqueueJob(
    'memory_write',
    { plan: writePlan, tenant },
    `journal:${update.updateId}`,
    update.updateId
  ).catch(() => {})
  void enqueueJob(
    'family_memory_feed_rebuild',
    { tenant },
    memoryFeedJobKey(tenant, getWeekKey()),
    update.updateId
  ).catch(() => {})

  return ok({ updateId: update.updateId, saved: true })
}

import 'server-only'

import {
  bumpEffectiveFamilyTurn,
  isDeepMechanismS2Enabled,
} from '@/lib/server/memory/deep-mechanism/turn-signal'
import { deepMechanismTurnMilestoneKey } from '@/lib/server/memory/deep-mechanism/s2-flags'
import { enqueueDeepMechanismReview } from '@/lib/server/jobs/queue'
import type { TenantId } from '@/lib/server/memory/tenant'

/**
 * 有效交流轮（daily L1 / 预演成功轮）后调用：计数；每满 10 轮入队 deep_mechanism_review。
 * fire-and-forget 友好：内部吞错，不阻塞前台。
 */
export async function noteEffectiveFamilyTurn(
  tenant: TenantId,
  source: 'daily' | 'rehearsal',
  traceId?: string | null
): Promise<void> {
  if (!isDeepMechanismS2Enabled()) return
  try {
    const { milestoneHit, milestone } = await bumpEffectiveFamilyTurn(tenant)
    if (!milestoneHit || milestone <= 0) return
    await enqueueDeepMechanismReview(tenant, {
      reason: 'turn_milestone',
      idempotencyKey: deepMechanismTurnMilestoneKey(tenant, milestone),
      traceId: traceId ?? null,
      forceFull: true,
    })
  } catch (err) {
    console.warn(`[deep-mechanism] noteEffectiveFamilyTurn(${source}) 失败:`, err)
  }
}

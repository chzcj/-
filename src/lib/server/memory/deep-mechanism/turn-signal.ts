import 'server-only'

import { loadMemoryLayerItemById, upsertMemoryLayerItems } from '@/lib/server/db'
import type { TenantId } from '@/lib/server/memory/tenant'
import { isDeepMechanismS2Enabled } from '@/lib/server/memory/deep-mechanism/s2-flags'

export { isDeepMechanismS2Enabled } from '@/lib/server/memory/deep-mechanism/s2-flags'

const LAYER = 'deep_mechanism_turn_signal'
const ITEM_ID = 'latest'

const MILESTONE = 10

export type DeepMechanismTurnSignal = {
  effectiveTurnCount: number
  lastMilestoneEnqueued: number
  /** 最近一次 deep_mechanism_review 成功完成时间 */
  lastCompletedAt: string | null
  /** 家长已看过 tip 的时间（≥ lastCompletedAt 则不再提示） */
  tipSeenAt: string | null
  updatedAt: string
}

const EMPTY: DeepMechanismTurnSignal = {
  effectiveTurnCount: 0,
  lastMilestoneEnqueued: 0,
  lastCompletedAt: null,
  tipSeenAt: null,
  updatedAt: '',
}

export async function loadDeepMechanismTurnSignal(
  tenant: TenantId
): Promise<DeepMechanismTurnSignal> {
  const item = await loadMemoryLayerItemById<DeepMechanismTurnSignal>(
    LAYER,
    ITEM_ID,
    tenant.familyId,
    tenant.childId
  ).catch(() => undefined)
  return item ? { ...EMPTY, ...item } : { ...EMPTY }
}

async function saveDeepMechanismTurnSignal(
  tenant: TenantId,
  signal: DeepMechanismTurnSignal
): Promise<void> {
  await upsertMemoryLayerItems(
    LAYER,
    [
      {
        itemId: ITEM_ID,
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: { ...signal, updatedAt: new Date().toISOString() },
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

export type EffectiveTurnBumpResult = {
  count: number
  milestoneHit: boolean
  milestone: number
}

/**
 * 记一记「有效交流轮」（含预演）。满 10 的倍数返回 milestoneHit，由调用方入队。
 * 不在此文件 import queue，避免循环依赖。
 */
export async function bumpEffectiveFamilyTurn(
  tenant: TenantId
): Promise<EffectiveTurnBumpResult> {
  if (!isDeepMechanismS2Enabled()) {
    return { count: 0, milestoneHit: false, milestone: 0 }
  }

  const prev = await loadDeepMechanismTurnSignal(tenant)
  const count = (prev.effectiveTurnCount || 0) + 1
  const milestoneHit = count > 0 && count % MILESTONE === 0
  const milestone = milestoneHit ? count : prev.lastMilestoneEnqueued

  await saveDeepMechanismTurnSignal(tenant, {
    ...prev,
    effectiveTurnCount: count,
    lastMilestoneEnqueued: milestoneHit ? count : prev.lastMilestoneEnqueued,
    updatedAt: new Date().toISOString(),
  })

  return { count, milestoneHit, milestone: milestoneHit ? count : 0 }
}

/** deep_mechanism_review 成功后调用：刷新 tip 水位 */
export async function markDeepMechanismJobCompleted(tenant: TenantId): Promise<void> {
  if (!isDeepMechanismS2Enabled()) return
  const prev = await loadDeepMechanismTurnSignal(tenant)
  const now = new Date().toISOString()
  await saveDeepMechanismTurnSignal(tenant, {
    ...prev,
    lastCompletedAt: now,
    // 新完成覆盖旧 tipSeen，让交流页再提示一次
    tipSeenAt: null,
    updatedAt: now,
  })
}

export type MechanismTipPayload = {
  show: boolean
  message: string
  completedAt: string | null
  effectiveTurnCount: number
}

const TIP_MESSAGE = '对你家的理解又加深了一点'

export async function getMechanismTipForDaily(
  tenant: TenantId
): Promise<MechanismTipPayload> {
  if (!isDeepMechanismS2Enabled()) {
    return { show: false, message: '', completedAt: null, effectiveTurnCount: 0 }
  }
  const signal = await loadDeepMechanismTurnSignal(tenant)
  const completedAt = signal.lastCompletedAt
  const seen = signal.tipSeenAt
  const show = Boolean(
    completedAt && (!seen || new Date(seen).getTime() < new Date(completedAt).getTime())
  )
  return {
    show,
    message: show ? TIP_MESSAGE : '',
    completedAt,
    effectiveTurnCount: signal.effectiveTurnCount || 0,
  }
}

export async function dismissMechanismTip(tenant: TenantId): Promise<void> {
  if (!isDeepMechanismS2Enabled()) return
  const prev = await loadDeepMechanismTurnSignal(tenant)
  const now = new Date().toISOString()
  await saveDeepMechanismTurnSignal(tenant, {
    ...prev,
    tipSeenAt: now,
    updatedAt: now,
  })
}

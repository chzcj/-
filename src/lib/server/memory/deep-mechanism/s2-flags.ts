/** S2 开关与 deep_mechanism 正交幂等键（无 server-only，可供契约测试 import） */

export function isDeepMechanismS2Enabled(): boolean {
  const v = (process.env.DEEP_MECHANISM_S2 || '1').trim().toLowerCase()
  return v !== '0' && v !== 'off' && v !== 'false'
}

export type DeepMechanismTenantRef = { familyId: string; childId: string }

function dayBucketUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** memory_write 链式日桶 */
export function deepMechanismBucketKey(tenant: DeepMechanismTenantRef): string {
  return `deep_mechanism:${tenant.familyId}:${tenant.childId}:${dayBucketUtc()}`
}

/** 每日打开（daily-refresh）独立键 — 与日桶 / 10 轮不互跳过 */
export function deepMechanismDailyOpenKey(tenant: DeepMechanismTenantRef): string {
  return `deep_mechanism:daily_open:${tenant.familyId}:${tenant.childId}:${dayBucketUtc()}`
}

/** 每 10 有效轮里程碑独立键 */
export function deepMechanismTurnMilestoneKey(
  tenant: DeepMechanismTenantRef,
  milestone: number
): string {
  return `deep_mechanism:turn:${tenant.familyId}:${tenant.childId}:${milestone}`
}

/** 每条新 Episode 的证据指纹键：同一证据只触发一次深度复核，不受日桶限制。 */
export function deepMechanismEvidenceKey(
  tenant: DeepMechanismTenantRef,
  episodeId: string
): string {
  return `deep_mechanism:evidence:${tenant.familyId}:${tenant.childId}:${episodeId}`
}

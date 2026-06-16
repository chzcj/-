import 'server-only'
import { getRequestIdentity } from '@/lib/server/auth'

/* ================================================================
   租户标识 — 多租户隔离的统一载体
   记忆域所有写入/检索按真实 familyId/childId 隔离。
   未登录 / demo / 解析异常一律回落 DEMO_TENANT，绝不抛。
   ================================================================ */

export interface TenantId {
  familyId: string
  childId: string
}

export const DEMO_TENANT: TenantId = { familyId: 'f_demo', childId: 'c_demo' }

/**
 * 路由入口统一解析当前请求的租户。
 * getRequestIdentity 内部已 cookies() + 查库 + catch，不会抛；public path 调用安全。
 */
export async function resolveTenant(fallback: TenantId = DEMO_TENANT): Promise<TenantId> {
  const id = await getRequestIdentity(fallback)
  return {
    familyId: id.familyId?.trim() || fallback.familyId,
    childId: id.childId?.trim() || fallback.childId
  }
}

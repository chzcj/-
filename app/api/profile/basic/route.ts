import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import {
  getChildBasicInfo,
  saveChildBasicInfo,
} from '@/lib/server/memory/database-manager'

/**
 * 孩子基础档（昵称/年级/年龄）。
 * Onboarding basic 页此前只写 localStorage，后端推理对孩子年龄一无所知；
 * 现同步落库（memory_layer_items: child_basic），供预演口吻、发展阶段判断、digest 注入。
 */
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const info = await getChildBasicInfo(tenant).catch(() => null)
  return ok({ basic: info })
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const body = await request.json().catch(() => ({}))
  const clean = (v: unknown, max: number) =>
    typeof v === 'string' ? v.trim().slice(0, max) : ''
  const nickname = clean(body?.nickname, 20)
  const grade = clean(body?.grade, 20)
  const age = clean(body?.age, 10)
  if (!nickname && !grade && !age) {
    return fail('BAD_REQUEST', '至少提供昵称、年级或年龄之一。', undefined, 400)
  }
  const tenant = await resolveTenant()
  await saveChildBasicInfo(
    { nickname, grade, age, updatedAt: new Date().toISOString() },
    tenant
  )
  return ok({ saved: true })
}

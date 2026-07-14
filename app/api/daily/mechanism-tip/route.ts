import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import {
  dismissMechanismTip,
  getMechanismTipForDaily,
} from '@/lib/server/memory/deep-mechanism/turn-signal'

/** GET：交流页 tip（机制加厚完成后提示「对你家的理解又加深了一点」） */
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const tip = await getMechanismTipForDaily(tenant)
  return ok(tip)
}

/** POST：家长关掉 tip / 看过后不再提示本轮完成 */
export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  if (body.action === 'dismiss' || body.dismiss === true) {
    await dismissMechanismTip(tenant)
    return ok({ dismissed: true })
  }
  return fail('BAD_REQUEST', '需要 action=dismiss', undefined, 400)
}

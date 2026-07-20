import { ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildMemoryMomentDetail } from '@/lib/server/profile/memory-moment-light'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const { id } = await context.params
    const decoded = decodeURIComponent(id || '')
    if (!decoded) return ok(null)
    const tenant = await resolveTenant()
    const detail = await buildMemoryMomentDetail(tenant, decoded)
    if (!detail) {
      return ok({ found: false })
    }
    return ok({ found: true, ...detail })
  } catch (error) {
    return failFromError(error)
  }
}

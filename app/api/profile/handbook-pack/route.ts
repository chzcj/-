import { ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildHandbookPack } from '@/lib/server/profile/handbook-pack-builder'

export const dynamic = 'force-dynamic'

/** 画像 Tab 成长手账：hero + handbook + memoryFeed + timeCapsule 一次拉齐 */
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const pack = await buildHandbookPack(tenant)
  return ok(pack)
}

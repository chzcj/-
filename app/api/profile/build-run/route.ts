import { ok, fail, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import {
  buildInputSnapshotFromBody,
  getProfileBuildRunView,
  startProfileBuildRun,
  toPublicBuildRun,
} from '@/lib/server/profile/build-run'
import { completedModuleCount } from '@/lib/profile/build-input'

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const tenant = await resolveTenant()
    const view = await getProfileBuildRunView(tenant)
    return ok(view)
  } catch (error) {
    return failFromError(error)
  }
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const body = await request.json().catch(() => ({}))
    const snapshot = buildInputSnapshotFromBody({
      entryMap: body?.entryMap,
      finalFollowUpText: body?.finalFollowUpText,
    })
    if (completedModuleCount(snapshot.entryMap) < 4) {
      return fail('INCOMPLETE_BUILD', '请先完成四个模块再提交。', undefined, 400)
    }
    const tenant = await resolveTenant()
    const run = await startProfileBuildRun(tenant, snapshot)
    const view = await getProfileBuildRunView(tenant)
    return ok({ ...view, run: toPublicBuildRun(run) })
  } catch (error) {
    return failFromError(error)
  }
}

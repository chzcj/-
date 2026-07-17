import { ok, fail, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import {
  getProfileBuildRunView,
  retryProfileBuildRun,
  toPublicBuildRun,
} from '@/lib/server/profile/build-run'
import type { ProfileBuildRunStage } from '@/lib/server/memory/database-manager'

const STAGES: ProfileBuildRunStage[] = ['synthesis', 'diagnosis', 'persist', 'readiness']

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const body = await request.json().catch(() => ({}))
    const fromStage =
      typeof body?.fromStage === 'string' && STAGES.includes(body.fromStage as ProfileBuildRunStage)
        ? (body.fromStage as ProfileBuildRunStage)
        : undefined
    const tenant = await resolveTenant()
    const run = await retryProfileBuildRun(tenant, fromStage)
    if (!run) {
      return fail('NO_FAILED_RUN', '当前没有可重试的画像生成任务。', undefined, 400)
    }
    const view = await getProfileBuildRunView(tenant)
    return ok({ ...view, run: toPublicBuildRun(run) })
  } catch (error) {
    return failFromError(error)
  }
}

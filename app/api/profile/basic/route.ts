import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { getCurrentUser } from '@/lib/server/auth'
import { resolveTenant } from '@/lib/server/memory/tenant'
import {
  getChildBasicInfo,
  saveChildBasicInfo,
  getLatestBuiltProfileSnapshot,
} from '@/lib/server/memory/database-manager'
import { setUserOnboardingComplete } from '@/lib/server/db'

/** 建档基础资料。首版画像不读取；后续任务、预演、成长轨迹可读取。 */
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
  const province = clean(body?.province, 30)
  const caregiverRelation = clean(body?.caregiverRelation, 40)
  const companionTime = clean(body?.companionTime, 200)
  const helpGoal = clean(body?.helpGoal, 500)
  if (!nickname || !grade || !province || !caregiverRelation || !companionTime || !helpGoal) {
    return fail('BAD_REQUEST', '请完成孩子和家庭的基础资料。', undefined, 400)
  }
  const tenant = await resolveTenant()
  await saveChildBasicInfo(
    {
      nickname,
      grade,
      age,
      province,
      caregiverRelation,
      companionTime,
      helpGoal,
      updatedAt: new Date().toISOString(),
    },
    tenant
  )
  const user = await getCurrentUser()
  const snapshot = await getLatestBuiltProfileSnapshot(tenant).catch(() => null)
  let onboardingComplete = Boolean(user?.onboardingComplete)
  if (
    user?.userId &&
    nickname &&
    grade &&
    snapshot?.coreJudgment?.trim()
  ) {
    await setUserOnboardingComplete(user.userId, true)
    onboardingComplete = true
  }
  return ok({ saved: true, onboardingComplete })
}

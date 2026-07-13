import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { callAgentJson, isFastAIEnabled } from '@/lib/server/ark-agents'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { getChildBasicInfo } from '@/lib/server/memory/database-manager'
import { listRecentUserTasks } from '@/lib/server/tasks/task-service'

type FamilyPlanResult = {
  enoughToPlan?: boolean
  acknowledgement?: string
  boundaryFirst?: string
  actions?: Array<{ title?: string; detail?: string }>
  missingInfo?: string
  note?: string
}

/**
 * 学业/家庭综合规划：接线一直存在但从未被调用的 familyPlanner agent。
 * 输入家长的规划诉求原话，注入 SecondMe digest + 孩子基础档 + 近期任务及反馈，
 * 输出 1-3 个可承受的小步动作（或在失败节点不明时先追问）。
 * 契约：childos.family_plan.v1（由 prompt 约束）。
 */
export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  if (!isFastAIEnabled()) {
    return fail('AI_UNCONFIGURED', '规划服务暂时不可用，请稍后再试。', undefined, 503)
  }

  const body = await request.json().catch(() => ({}))
  const parentText = typeof body?.parentText === 'string' ? body.parentText.trim().slice(0, 2000) : ''
  if (!parentText) {
    return fail('NEED_PARENT_WORDS', '先把您想规划的事情说给我听——比如纠结要不要补课、兴趣班怎么取舍。', undefined, 400)
  }

  const tenant = await resolveTenant()
  const [digest, childBasic, recentTasks] = await Promise.all([
    loadDeepModelDigest(tenant).catch(() => null),
    getChildBasicInfo(tenant).catch(() => null),
    listRecentUserTasks(tenant).catch(() => []),
  ])

  const result = await callAgentJson<FamilyPlanResult>(
    'familyPlanner',
    '家长带着一个规划类的纠结来了。结合孩子深度模型与过往任务反馈，按你的原则输出规划 JSON。',
    {
      parentText,
      childBasic: childBasic
        ? [childBasic.age ? `${childBasic.age}岁` : '', childBasic.grade || ''].filter(Boolean).join('，')
        : '',
      deepModelDigest: pickDeepModelDigestPack(digest),
      recentTasks: recentTasks.slice(0, 6).map((t) => ({
        title: t.title,
        status: t.status,
        feedback: t.feedback || null,
      })),
    }
  ).catch(() => undefined)

  if (!result || typeof result.acknowledgement !== 'string') {
    return fail('PLANNING_UNAVAILABLE', '这次没有规划出来，可以稍后再试。', undefined, 503)
  }

  return ok({
    enoughToPlan: result.enoughToPlan !== false,
    acknowledgement: result.acknowledgement || '',
    boundaryFirst: typeof result.boundaryFirst === 'string' ? result.boundaryFirst : '',
    actions: Array.isArray(result.actions)
      ? result.actions
          .filter((a) => a && typeof a.title === 'string' && a.title.trim())
          .slice(0, 3)
          .map((a) => ({ title: a.title!.trim(), detail: typeof a.detail === 'string' ? a.detail.trim() : '' }))
      : [],
    missingInfo: typeof result.missingInfo === 'string' ? result.missingInfo : '',
    note: typeof result.note === 'string' ? result.note : '',
  })
}

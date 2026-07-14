import 'server-only'

import { callAgentJson } from '@/lib/server/ark-agents'
import { getUserTasks, saveUserTasks } from '@/lib/server/memory/database-manager'
import type { TenantId } from '@/lib/server/memory/tenant'

const TASK_TITLE_BANNED =
  /模式能对上|标记为|观察记录|当前输入|已有画像|写入记忆|判断有更新|待验证|今晚试一下|今晚可以试一次|今晚先试一次/i

function sanitizeGeneratedTitle(raw: unknown, seedTitle: string): string {
  const seedRaw = seedTitle.trim().replace(TASK_TITLE_BANNED, '').trim()
  const seed = (seedRaw.slice(0, 20) || '到点只说一句开始然后等').slice(0, 20)
  if (typeof raw !== 'string') return seed
  let title = raw.trim().replace(/^["「]|["」]$/g, '')
  title = title.replace(/今晚可以试一次[：:]?/g, '').replace(/今晚试一下[：:]?/g, '').trim()
  title = title.slice(0, 20)
  if (title.length < 8 || TASK_TITLE_BANNED.test(title)) return seed
  return title
}

/** 保存任务后轻度异步：专用 Agent 润色标题（10–20 字完整句）。 */
export async function refineTonightTaskInBackground(args: {
  tenant: TenantId
  taskId: string
  seedTitle: string
  observation?: string
  replyExcerpt?: string
}): Promise<void> {
  const ai = await callAgentJson<{ title?: string }>(
    'tonightTaskGenerator',
    '生成家长可执行的小任务标题（10–20字完整一句，禁止今晚试一下套话）。',
    {
      seedTitle: args.seedTitle.slice(0, 40),
      observation: (args.observation || '').slice(0, 80),
      replyExcerpt: (args.replyExcerpt || '').slice(0, 600),
    },
    { maxTokens: 120 }
  ).catch(() => undefined)

  const nextTitle = sanitizeGeneratedTitle(ai?.title, args.seedTitle)
  if (!nextTitle || nextTitle === args.seedTitle.trim()) return

  const all = await getUserTasks(args.tenant)
  const idx = all.findIndex((t) => t.taskId === args.taskId)
  if (idx < 0) return
  if (all[idx].title === nextTitle) return

  all[idx] = {
    ...all[idx],
    title: nextTitle,
    updatedAt: new Date().toISOString(),
  }
  await saveUserTasks(all, args.tenant)
}

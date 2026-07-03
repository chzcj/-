import 'server-only'

import type { UserTask } from '@/types/database'
import { getUserTasks, saveUserTasks } from '@/lib/server/memory/database-manager'
import { buildMemoryWritePlan, createDailyUpdate } from '@/lib/server/memory/pipeline'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import type { TenantId } from '@/lib/server/memory/tenant'
import { createId } from '@/lib/storage/storageIds'

const MAX_STORED = 50
const MAX_LIST = 7

export async function listRecentUserTasks(tenant: TenantId): Promise<UserTask[]> {
  const all = await getUserTasks(tenant)
  return all
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_LIST)
}

export async function createUserTask(
  tenant: TenantId,
  args: { title: string; source?: string; sourceTraceId?: string }
): Promise<UserTask> {
  const title = args.title.trim()
  if (!title) throw new Error('EMPTY_TITLE')

  const now = new Date().toISOString()
  const task: UserTask = {
    taskId: createId('task'),
    familyId: tenant.familyId,
    childId: tenant.childId,
    title,
    source: args.source?.trim() || '交流',
    status: '待执行',
    sourceTraceId: args.sourceTraceId?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }

  const existing = await getUserTasks(tenant)
  const merged = [task, ...existing]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_STORED)

  await saveUserTasks(merged, tenant)

  // 保存为今晚任务 = 家长认定这条值得执行 → 同步沉淀 episode（含六维深拆），供长期检索。
  // 幂等：episodeId 由 (tenant + sha(title)) 派生，重复保存同标题只写一次。
  const episodeId = deriveEpisodeId(title, { familyId: tenant.familyId, childId: tenant.childId })
  void enqueueJob(
    'episode_ingest',
    { text: title, ctx: { sourceEventId: args.sourceTraceId, familyId: tenant.familyId, childId: tenant.childId, episodeId } },
    episodeId,
    args.sourceTraceId || null
  )
  // 任务保存时同步深拆（低频）：六维拆解 + 新假设，链式 memory_write + model_review。
  const taskTraceId = args.sourceTraceId || createId('trace')
  void enqueueJob('daily_deep', { text: title, tenant, traceId: taskTraceId }, `daily_deep_${episodeId}`, taskTraceId)

  return task
}

export async function applyUserTaskFeedback(
  tenant: TenantId,
  taskId: string,
  feedback: NonNullable<UserTask['feedback']>,
  status: string
): Promise<UserTask | null> {
  const all = await getUserTasks(tenant)
  const idx = all.findIndex((t) => t.taskId === taskId)
  if (idx < 0) return null

  const note = feedback.note?.trim()
  const updated: UserTask = {
    ...all[idx],
    feedback,
    status: status || all[idx].status,
    observation: note || all[idx].observation,
    updatedAt: new Date().toISOString(),
  }
  all[idx] = updated
  await saveUserTasks(all, tenant)

  const traceId = updated.sourceTraceId || createId('trace')
  const summary = [
    feedback.completed ? `完成：${feedback.completed}` : '',
    feedback.effect ? `效果：${feedback.effect}` : '',
    feedback.reaction ? `孩子反应：${feedback.reaction}` : '',
    note ? `补充：${note}` : '',
  ]
    .filter(Boolean)
    .join('；')

  const writePlan = buildMemoryWritePlan({
    tenant,
    dailyUpdates: [
      createDailyUpdate(
        `[任务反馈] ${updated.title} — ${summary || '家长提交了执行反馈'}`,
        'new_supporting_evidence',
        [],
        tenant,
        traceId
      ),
    ],
    rationale: {
      whyUpdate: '家长完成任务后反馈真实执行结果，作为 supporting evidence',
      whyNotPromoteSomeItems: '单次任务反馈不足以升为稳定画像',
      riskOfOvergeneralization: '需结合多次交流验证',
      nextVerificationNeed: updated.title.slice(0, 80),
    },
  })

  void enqueueJob('memory_write', { plan: writePlan, tenant }, `task_feedback_${taskId}`, traceId)

  return updated
}

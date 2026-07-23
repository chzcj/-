import 'server-only'

import type { UserTask } from '@/types/database'
import { getTurnEventByTraceId, getUserTasks, saveUserTasks } from '@/lib/server/memory/database-manager'
import { buildMemoryWritePlan, createDailyUpdate } from '@/lib/server/memory/pipeline'
import { enqueueJob, enqueueDeepMechanismReview } from '@/lib/server/jobs/queue'
import { deepMechanismDebounceKey } from '@/lib/server/memory/deep-mechanism/s2-flags'
import { markDossierPredictionFailed } from '@/lib/server/memory/dossier/prediction-failure'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import type { TenantId } from '@/lib/server/memory/tenant'
import { createId } from '@/lib/storage/storageIds'
import { buildTaskReplyExcerpt } from '@yujian/contracts/task-seed'
import { refineTonightTaskInBackground } from '@/lib/server/tasks/tonight-task-agent'

const MAX_STORED = 50
const MAX_CURRENT = 3

function isUnsatisfiedTaskFeedback(
  feedback: NonNullable<UserTask['feedback']>,
  status: string
): boolean {
  if (status === 'completed_but_unsatisfied') return true
  const blob = [feedback.effect, feedback.note, feedback.completed, status].filter(Boolean).join(' ')
  return blob.includes('未达预期')
}

const refiningTaskIds = new Set<string>()

function isCurrentTask(task: UserTask): boolean {
  return task.status !== '已完成' && task.status !== '已过期'
}

function taskNeedsRefine(task: UserTask): boolean {
  return !task.rationale?.trim() || !task.actionHint?.trim()
}

async function resolveTaskReplyExcerpt(tenant: TenantId, task: UserTask): Promise<string | undefined> {
  if (task.sourceTraceId) {
    const turn = await getTurnEventByTraceId(tenant, task.sourceTraceId).catch(() => null)
    if (turn?.assistantReply?.trim()) {
      const pack = turn.specializedContextPackSnapshot as
        | { sections?: Array<{ id?: string; hidden?: boolean; paragraphs?: string[]; items?: string[] }> }
        | undefined
      const excerpt = buildTaskReplyExcerpt(turn.assistantReply, pack?.sections)
      if (excerpt.length >= 40) return excerpt
    }
  }
  return task.title
}

function scheduleTaskRefineIfNeeded(tenant: TenantId, tasks: UserTask[]): void {
  for (const task of tasks) {
    if (!taskNeedsRefine(task)) continue
    if (refiningTaskIds.has(task.taskId)) continue
    refiningTaskIds.add(task.taskId)
    void (async () => {
      try {
        const replyExcerpt = await resolveTaskReplyExcerpt(tenant, task)
        await refineTonightTaskInBackground({
          tenant,
          taskId: task.taskId,
          seedTitle: task.title,
          observation: task.observation,
          replyExcerpt,
        })
      } catch {
        /* ignore */
      } finally {
        refiningTaskIds.delete(task.taskId)
      }
    })()
  }
}

export async function listRecentUserTasks(tenant: TenantId): Promise<{ current: UserTask[]; history: UserTask[] }> {
  const all = await getUserTasks(tenant)
  const sorted = all
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const current = sorted.filter(isCurrentTask).slice(0, MAX_CURRENT)
  scheduleTaskRefineIfNeeded(tenant, current)
  return {
    current,
    history: sorted.filter((task) => !isCurrentTask(task)).slice(0, MAX_STORED),
  }
}

export async function createUserTask(
  tenant: TenantId,
  args: {
    title: string
    source?: string
    sourceTraceId?: string
    observation?: string
    /** 本轮 AI 回复节选，供今晚任务 Agent 异步润色标题 */
    replyExcerpt?: string
    clientId?: string
  }
): Promise<UserTask> {
  const title = args.title.trim()
  if (!title) throw new Error('EMPTY_TITLE')

  const existing = await getUserTasks(tenant)
  if (args.clientId?.trim()) {
    const hit = existing.find((t) => t.clientId === args.clientId)
    if (hit) return hit
  }

  const now = new Date().toISOString()
  const task: UserTask = {
    taskId: createId('task'),
    familyId: tenant.familyId,
    childId: tenant.childId,
    title,
    source: args.source?.trim() || '交流',
    status: '待执行',
    sourceTraceId: args.sourceTraceId?.trim() || undefined,
    observation: args.observation?.trim() || undefined,
    clientId: args.clientId?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }

  const sorted = [task, ...existing]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  let activeSeen = 0
  const merged = sorted
    .map((item) => {
      if (!isCurrentTask(item)) return item
      activeSeen += 1
      return activeSeen > MAX_CURRENT
        ? { ...item, status: '已过期', updatedAt: now }
        : item
    })
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

  // 保存后同步 refine（最多等 5s），让任务 Tab 首屏就有 scene/hint/rationale
  try {
    await Promise.race([
      refineTonightTaskInBackground({
        tenant,
        taskId: task.taskId,
        seedTitle: title,
        observation: args.observation,
        replyExcerpt: args.replyExcerpt,
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 8000)),
    ])
    const refreshed = (await getUserTasks(tenant)).find((t) => t.taskId === task.taskId)
    if (refreshed) return refreshed
  } catch (err) {
    console.warn('[tonight-task] refine failed:', err instanceof Error ? err.message : err)
  }

  return task
}

export async function applyUserTaskFeedback(
  tenant: TenantId,
  taskId: string,
  feedback: NonNullable<UserTask['feedback']>,
  status: string,
  clientFeedbackAt?: string
): Promise<UserTask | null> {
  const all = await getUserTasks(tenant)
  const idx = all.findIndex((t) => t.taskId === taskId)
  if (idx < 0) return null

  const current = all[idx]
  const incomingAt = clientFeedbackAt?.trim()
  if (
    incomingAt &&
    current.feedbackClientAt &&
    new Date(incomingAt).getTime() < new Date(current.feedbackClientAt).getTime()
  ) {
    return current
  }

  const note = feedback.note?.trim()
  const updated: UserTask = {
    ...current,
    feedback,
    status: status || current.status,
    observation: note || current.observation,
    feedbackClientAt: incomingAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  all[idx] = updated
  await saveUserTasks(all, tenant)

  const traceId = updated.sourceTraceId || createId('trace')

  const predId = updated.linkedPredictionId?.trim()
  if (predId && isUnsatisfiedTaskFeedback(feedback, status || updated.status)) {
    const marked = await markDossierPredictionFailed(
      tenant,
      predId,
      `v*: pred_${predId} 标记 failed：任务 ${taskId} 未达预期`
    ).catch(() => false)
    if (marked) {
      void enqueueDeepMechanismReview(tenant, {
        reason: 'prediction_failed',
        idempotencyKey: `${deepMechanismDebounceKey(tenant)}:pred_failed:${predId}`,
        traceId,
        forceFull: true,
      })
    }
  }
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

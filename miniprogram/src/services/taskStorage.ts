import Taro from '@tarojs/taro'
import { apiRequest } from '@/services/api'
import { coerceTaskSeedTitle } from '@yujian/contracts/task-seed'
import {
  enqueueTaskCreate,
  enqueueTaskFeedback,
  flushTaskOutbox,
  makeTaskClientId,
  patchLocalTaskIdByClientId,
  retryFailedTaskOutbox,
  type TaskOutboxFlushResult,
} from '@/services/taskOutbox'

export type TaskFeedback = {
  completed?: string
  effect?: string
  reaction?: string
  note?: string
}

export type TaskItem = {
  id: string
  title: string
  source?: string
  observation?: string
  sceneLabel?: string
  actionHint?: string
  rationale?: string
  status?: string
  feedback?: TaskFeedback
  sourceTraceId?: string
  clientId?: string
  createdAt: string
}

const STORAGE_KEY = 'childos.v2.tasks'

type ServerTask = {
  taskId: string
  title: string
  source?: string
  status?: string
  observation?: string
  sceneLabel?: string
  actionHint?: string
  rationale?: string
  feedback?: TaskFeedback
  sourceTraceId?: string
  clientId?: string
  createdAt: string
}

function loadLocalTasks(): TaskItem[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalTasks(items: TaskItem[]) {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(items.slice(0, 20)))
  } catch {
    /* ignore */
  }
}

function mapServerTask(t: ServerTask): TaskItem {
  return {
    id: t.taskId,
    title: t.title,
    source: t.source,
    status: t.status,
    observation: t.observation,
    sceneLabel: t.sceneLabel,
    actionHint: t.actionHint,
    rationale: t.rationale,
    feedback: t.feedback,
    sourceTraceId: t.sourceTraceId,
    clientId: t.clientId,
    createdAt: t.createdAt,
  }
}

function taskRichness(task: TaskItem): number {
  return (
    (task.rationale?.trim() ? 4 : 0) +
    (task.actionHint?.trim() ? 2 : 0) +
    (task.sceneLabel?.trim() ? 1 : 0) +
    (task.id.startsWith('task_') ? 1 : 0)
  )
}

function mergeTaskPair(primary: TaskItem, secondary: TaskItem): TaskItem {
  const richer = taskRichness(primary) >= taskRichness(secondary) ? primary : secondary
  const other = richer === primary ? secondary : primary
  const id = richer.id.startsWith('task_')
    ? richer.id
    : other.id.startsWith('task_')
      ? other.id
      : richer.id
  return {
    ...other,
    ...richer,
    id,
    clientId: richer.clientId || other.clientId,
    sceneLabel: richer.sceneLabel || other.sceneLabel,
    actionHint: richer.actionHint || other.actionHint,
    rationale: richer.rationale || other.rationale,
    feedback: richer.feedback || other.feedback,
    status: richer.status || other.status,
  }
}

function mergeTasks(local: TaskItem[], server: TaskItem[]): TaskItem[] {
  const byId = new Map<string, TaskItem>()
  const clientIdToServerId = new Map<string, string>()

  for (const task of server) {
    byId.set(task.id, task)
    if (task.clientId) clientIdToServerId.set(task.clientId, task.id)
  }

  for (const task of local) {
    const canonicalId =
      task.clientId && clientIdToServerId.has(task.clientId)
        ? clientIdToServerId.get(task.clientId)!
        : task.id
    const normalized = canonicalId === task.id ? task : { ...task, id: canonicalId }
    const existing = byId.get(canonicalId)
    byId.set(canonicalId, existing ? mergeTaskPair(existing, normalized) : normalized)
  }

  const deduped = new Map<string, TaskItem>()
  const noTrace: TaskItem[] = []
  for (const task of byId.values()) {
    if (task.sourceTraceId) {
      const prev = deduped.get(task.sourceTraceId)
      deduped.set(task.sourceTraceId, prev ? mergeTaskPair(prev, task) : task)
    } else {
      noTrace.push(task)
    }
  }

  return [...deduped.values(), ...noTrace].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

function upsertLocalTask(serverTask: TaskItem, clientId: string) {
  const local = loadLocalTasks().filter(
    (task) =>
      task.id !== clientId &&
      task.clientId !== clientId &&
      task.id !== serverTask.id &&
      !(task.sourceTraceId && task.sourceTraceId === serverTask.sourceTraceId)
  )
  saveLocalTasks([serverTask, ...local].slice(0, 20))
}

export async function fetchTasksFromServer(): Promise<{ current: TaskItem[]; history: TaskItem[] }> {
  try {
    await flushTaskOutbox((clientId, serverTaskId) => {
      saveLocalTasks(patchLocalTaskIdByClientId(loadLocalTasks(), clientId, serverTaskId))
    })
    const local = loadLocalTasks()
    const res = await apiRequest<{ tasks?: ServerTask[]; history?: ServerTask[] }>('/api/tasks', { method: 'GET' })
    if (!res.ok || !Array.isArray(res.data.tasks)) return { current: local, history: [] }
    const server = [...res.data.tasks, ...(res.data.history || [])].map(mapServerTask)
    const merged = mergeTasks(local, server)
    saveLocalTasks(merged)
    return {
      current: merged.filter((task) => task.status !== '已完成' && task.status !== '已过期').slice(0, 3),
      history: merged.filter((task) => task.status === '已完成' || task.status === '已过期'),
    }
  } catch {
    return { current: loadLocalTasks(), history: [] }
  }
}

export function getTasks(): TaskItem[] {
  return loadLocalTasks()
}

export async function saveTask(
  title: string,
  source = '交流',
  sourceTraceId?: string,
  extras?: { observation?: string; replyExcerpt?: string }
): Promise<boolean> {
  if (!title.trim()) return false
  const normalizedTitle = coerceTaskSeedTitle(title, '到点只说一句开始然后等')
  if (!normalizedTitle.trim()) return false
  const observation = extras?.observation?.trim() || undefined
  const replyExcerpt = extras?.replyExcerpt?.trim() || undefined
  const clientId = makeTaskClientId()
  try {
    const res = await apiRequest<{ task?: ServerTask }>('/api/tasks', {
      method: 'POST',
      data: {
        title: normalizedTitle,
        source,
        clientId,
        ...(sourceTraceId ? { sourceTraceId } : {}),
        ...(observation ? { observation } : {}),
        ...(replyExcerpt ? { replyExcerpt } : {}),
      },
    })
    if (res.ok && res.data.task) {
      upsertLocalTask(mapServerTask(res.data.task), clientId)
      await fetchTasksFromServer()
      return true
    }
    if (res.ok) {
      await fetchTasksFromServer()
      return true
    }
  } catch {
    /* fallback outbox */
  }
  enqueueTaskCreate({
    clientId,
    title: normalizedTitle,
    source,
    sourceTraceId,
    observation,
    replyExcerpt,
  })
  const next: TaskItem = {
    id: clientId,
    clientId,
    title: normalizedTitle,
    source,
    status: '待执行',
    sourceTraceId,
    observation,
    createdAt: new Date().toISOString(),
  }
  saveLocalTasks([next, ...loadLocalTasks()].slice(0, 20))
  return true
}

export async function saveTaskFromRehearsal(
  title: string,
  source = '沟通预演',
  sourceTraceId?: string
): Promise<boolean> {
  return saveTask(title, source, sourceTraceId)
}

export async function updateTaskFeedback(
  taskId: string,
  feedback: TaskFeedback,
  status: string
): Promise<void> {
  const clientFeedbackAt = new Date().toISOString()
  const feedbackClientId = `cfeedback_${taskId}_${Date.now()}`
  try {
    const res = await apiRequest<{ task?: ServerTask }>(
      `/api/tasks/${encodeURIComponent(taskId)}/feedback`,
      {
        method: 'POST',
        data: { feedback, status, clientFeedbackAt },
      }
    )
    if (res.ok) {
      await fetchTasksFromServer()
      return
    }
  } catch {
    /* fallback outbox */
  }
  enqueueTaskFeedback({
    clientId: feedbackClientId,
    taskId,
    feedback,
    status,
    clientFeedbackAt,
  })
  const items = loadLocalTasks().map((t) =>
    t.id === taskId
      ? {
          ...t,
          feedback,
          status,
          observation: feedback.note?.trim() || t.observation,
        }
      : t
  )
  saveLocalTasks(items)
}

export async function retryTaskOutboxSync(): Promise<TaskOutboxFlushResult> {
  return retryFailedTaskOutbox((clientId, serverTaskId) => {
    saveLocalTasks(patchLocalTaskIdByClientId(loadLocalTasks(), clientId, serverTaskId))
  })
}

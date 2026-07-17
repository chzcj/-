import Taro from '@tarojs/taro'
import { apiRequest } from '@/services/api'
import { normalizeTaskTitle } from '@/lib/textDisplay'

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
  status?: string
  feedback?: TaskFeedback
  sourceTraceId?: string
  createdAt: string
}

const STORAGE_KEY = 'childos.v2.tasks'

type ServerTask = {
  taskId: string
  title: string
  source?: string
  status?: string
  observation?: string
  feedback?: TaskFeedback
  sourceTraceId?: string
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
    feedback: t.feedback,
    sourceTraceId: t.sourceTraceId,
    createdAt: t.createdAt,
  }
}

function mergeTasks(local: TaskItem[], server: TaskItem[]): TaskItem[] {
  const byId = new Map<string, TaskItem>()
  for (const t of [...server, ...local]) {
    const existing = byId.get(t.id)
    if (!existing || new Date(t.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
      byId.set(t.id, t)
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function fetchTasksFromServer(): Promise<{ current: TaskItem[]; history: TaskItem[] }> {
  try {
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
  const normalizedTitle = normalizeTaskTitle(title, '到点只说一句开始然后等')
  if (!normalizedTitle.trim()) return false
  const observation = extras?.observation?.trim() || undefined
  const replyExcerpt = extras?.replyExcerpt?.trim() || undefined
  try {
    const res = await apiRequest<{ task?: ServerTask }>('/api/tasks', {
      method: 'POST',
      data: {
        title: normalizedTitle,
        source,
        ...(sourceTraceId ? { sourceTraceId } : {}),
        ...(observation ? { observation } : {}),
        ...(replyExcerpt ? { replyExcerpt } : {}),
      },
    })
    if (res.ok) {
      await fetchTasksFromServer()
      return true
    }
  } catch {
    /* fallback local */
  }
  const next: TaskItem = {
    id: `task_${Date.now()}`,
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
  try {
    const res = await apiRequest<{ task?: ServerTask }>(
      `/api/tasks/${encodeURIComponent(taskId)}/feedback`,
      {
        method: 'POST',
        data: { feedback, status },
      }
    )
    if (res.ok) {
      await fetchTasksFromServer()
      return
    }
  } catch {
    /* fallback local */
  }
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

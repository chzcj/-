import Taro from '@tarojs/taro'
import { apiRequest } from '@/services/api'

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

export async function fetchTasksFromServer(): Promise<TaskItem[]> {
  try {
    const res = await apiRequest<{ tasks?: ServerTask[] }>('/api/tasks', { method: 'GET' })
    if (!res.ok || !Array.isArray(res.data.tasks)) return loadLocalTasks()
    const tasks = res.data.tasks.map(mapServerTask)
    saveLocalTasks(tasks)
    return tasks
  } catch {
    return loadLocalTasks()
  }
}

export function getTasks(): TaskItem[] {
  return loadLocalTasks()
}

export async function saveTask(
  title: string,
  source = '交流',
  sourceTraceId?: string
): Promise<boolean> {
  if (!title.trim()) return false
  try {
    const res = await apiRequest<{ task?: ServerTask }>('/api/tasks', {
      method: 'POST',
      data: {
        title: title.trim(),
        source,
        ...(sourceTraceId ? { sourceTraceId } : {}),
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
    title: title.trim(),
    source,
    status: '待执行',
    sourceTraceId,
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

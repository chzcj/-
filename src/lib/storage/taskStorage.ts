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

function loadLocalTasks(): TaskItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TaskItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalTasks(items: TaskItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 20)))
  } catch {
    /* ignore */
  }
}

function mapServerTask(t: {
  taskId: string
  title: string
  source?: string
  status?: string
  observation?: string
  feedback?: TaskFeedback
  sourceTraceId?: string
  createdAt: string
}): TaskItem {
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
  if (typeof window === 'undefined') return []
  try {
    const res = await fetch('/api/tasks')
    const json = (await res.json()) as { ok?: boolean; data?: { tasks?: unknown[] } }
    if (!json.ok || !Array.isArray(json.data?.tasks)) return loadLocalTasks()
    const tasks = json.data.tasks.map((t) => mapServerTask(t as never))
    saveLocalTasks(tasks)
    return tasks
  } catch {
    return loadLocalTasks()
  }
}

export function getTasks(): TaskItem[] {
  return loadLocalTasks()
}

export async function saveTask(title: string, source = '交流', sourceTraceId?: string) {
  if (typeof window === 'undefined' || !title.trim()) return
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), source, sourceTraceId }),
    })
    const json = (await res.json()) as { ok?: boolean; data?: { task?: { taskId: string } } }
    if (json.ok) {
      await fetchTasksFromServer()
      return
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
}

export async function saveTaskFromRehearsal(title: string, source = '沟通预演', sourceTraceId?: string) {
  await saveTask(title, source, sourceTraceId)
}

export async function updateTaskFeedback(taskId: string, feedback: TaskFeedback, status: string) {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, status }),
    })
    const json = (await res.json()) as { ok?: boolean }
    if (json.ok) {
      await fetchTasksFromServer()
      return
    }
  } catch {
    /* fallback */
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

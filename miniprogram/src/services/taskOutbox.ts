import Taro from '@tarojs/taro'
import { apiRequest } from '@/services/api'
import type { TaskFeedback, TaskItem } from '@/services/taskStorage'

const OUTBOX_KEY = 'childos.v2.task_outbox'
const MAX_ATTEMPTS = 8

type CreateOutboxEntry = {
  kind: 'create'
  clientId: string
  title: string
  source: string
  sourceTraceId?: string
  observation?: string
  replyExcerpt?: string
  createdAt: string
  attempts: number
}

type FeedbackOutboxEntry = {
  kind: 'feedback'
  clientId: string
  taskId: string
  feedback: TaskFeedback
  status: string
  clientFeedbackAt: string
  createdAt: string
  attempts: number
}

export type TaskOutboxEntry = CreateOutboxEntry | FeedbackOutboxEntry

function loadOutbox(): TaskOutboxEntry[] {
  try {
    const raw = Taro.getStorageSync(OUTBOX_KEY)
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? (parsed as TaskOutboxEntry[]) : []
  } catch {
    return []
  }
}

function saveOutbox(entries: TaskOutboxEntry[]) {
  try {
    Taro.setStorageSync(OUTBOX_KEY, JSON.stringify(entries.slice(0, 40)))
  } catch {
    /* ignore */
  }
}

export function makeTaskClientId(): string {
  return `ctask_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function enqueueTaskCreate(entry: Omit<CreateOutboxEntry, 'kind' | 'attempts' | 'createdAt'>) {
  const outbox = loadOutbox().filter((item) => !(item.kind === 'create' && item.clientId === entry.clientId))
  outbox.unshift({
    kind: 'create',
    ...entry,
    createdAt: new Date().toISOString(),
    attempts: 0,
  })
  saveOutbox(outbox)
}

export function enqueueTaskFeedback(entry: Omit<FeedbackOutboxEntry, 'kind' | 'attempts' | 'createdAt'>) {
  const outbox = loadOutbox().filter(
    (item) => !(item.kind === 'feedback' && item.clientId === entry.clientId)
  )
  outbox.unshift({
    kind: 'feedback',
    ...entry,
    createdAt: new Date().toISOString(),
    attempts: 0,
  })
  saveOutbox(outbox)
}

export async function flushTaskOutbox(
  remapLocalTaskId?: (clientId: string, serverTaskId: string) => void
): Promise<void> {
  let outbox = loadOutbox()
  if (outbox.length === 0) return

  const remaining: TaskOutboxEntry[] = []
  for (const item of [...outbox].reverse()) {
    if (item.attempts >= MAX_ATTEMPTS) {
      remaining.unshift(item)
      continue
    }

    if (item.kind === 'create') {
      const res = await apiRequest<{ task?: { taskId: string } }>('/api/tasks', {
        method: 'POST',
        data: {
          title: item.title,
          source: item.source,
          clientId: item.clientId,
          ...(item.sourceTraceId ? { sourceTraceId: item.sourceTraceId } : {}),
          ...(item.observation ? { observation: item.observation } : {}),
          ...(item.replyExcerpt ? { replyExcerpt: item.replyExcerpt } : {}),
        },
      })
      if (res.ok && res.data.task?.taskId) {
        remapLocalTaskId?.(item.clientId, res.data.task.taskId)
        continue
      }
      remaining.unshift({ ...item, attempts: item.attempts + 1 })
      continue
    }

    const res = await apiRequest<{ task?: { taskId: string } }>(
      `/api/tasks/${encodeURIComponent(item.taskId)}/feedback`,
      {
        method: 'POST',
        data: {
          feedback: item.feedback,
          status: item.status,
          clientFeedbackAt: item.clientFeedbackAt,
        },
      }
    )
    if (res.ok) continue
    remaining.unshift({ ...item, attempts: item.attempts + 1 })
  }

  outbox = remaining
  saveOutbox(outbox)
}

export function patchLocalTaskIdByClientId(
  items: TaskItem[],
  clientId: string,
  serverTaskId: string
): TaskItem[] {
  return items.map((task) =>
    task.clientId === clientId || task.id === clientId
      ? { ...task, id: serverTaskId, clientId }
      : task
  )
}

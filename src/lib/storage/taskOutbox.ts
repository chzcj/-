import type { TaskFeedback, TaskItem } from '@/lib/storage/taskStorage'

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
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TaskOutboxEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveOutbox(entries: TaskOutboxEntry[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries.slice(0, 40)))
  } catch {
    /* ignore */
  }
}

export function makeTaskClientId(): string {
  return `ctask_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function enqueueTaskCreate(entry: Omit<CreateOutboxEntry, 'kind' | 'attempts' | 'createdAt'>) {
  const outbox = loadOutbox().filter((item) => !(item.kind === 'create' && item.clientId === entry.clientId))
  outbox.unshift({ kind: 'create', ...entry, createdAt: new Date().toISOString(), attempts: 0 })
  saveOutbox(outbox)
}

export function enqueueTaskFeedback(entry: Omit<FeedbackOutboxEntry, 'kind' | 'attempts' | 'createdAt'>) {
  const outbox = loadOutbox().filter(
    (item) => !(item.kind === 'feedback' && item.clientId === entry.clientId)
  )
  outbox.unshift({ kind: 'feedback', ...entry, createdAt: new Date().toISOString(), attempts: 0 })
  saveOutbox(outbox)
}

export async function flushTaskOutbox(
  remapLocalTaskId?: (clientId: string, serverTaskId: string) => void
): Promise<void> {
  if (typeof window === 'undefined') return
  let outbox = loadOutbox()
  if (outbox.length === 0) return

  const remaining: TaskOutboxEntry[] = []
  for (const item of [...outbox].reverse()) {
    if (item.attempts >= MAX_ATTEMPTS) {
      remaining.unshift(item)
      continue
    }

    if (item.kind === 'create') {
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            source: item.source,
            clientId: item.clientId,
            sourceTraceId: item.sourceTraceId,
            observation: item.observation,
            replyExcerpt: item.replyExcerpt,
          }),
        })
        const json = (await res.json()) as { ok?: boolean; data?: { task?: { taskId: string } } }
        if (json.ok && json.data?.task?.taskId) {
          remapLocalTaskId?.(item.clientId, json.data.task.taskId)
          continue
        }
      } catch {
        /* retry later */
      }
      remaining.unshift({ ...item, attempts: item.attempts + 1 })
      continue
    }

    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(item.taskId)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: item.feedback,
          status: item.status,
          clientFeedbackAt: item.clientFeedbackAt,
        }),
      })
      const json = (await res.json()) as { ok?: boolean }
      if (json.ok) continue
    } catch {
      /* retry later */
    }
    remaining.unshift({ ...item, attempts: item.attempts + 1 })
  }

  saveOutbox(remaining)
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

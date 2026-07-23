'use client'

import { useEffect, useRef, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { TaskFeedbackPanel, taskStatusVariant } from '@/components/tasks/TaskFeedbackPanel'
import {
  fetchTasksFromServer,
  updateTaskFeedback,
  retryTaskOutboxSync,
  type TaskFeedback,
  type TaskItem,
} from '@/lib/storage/taskStorage'
import { getTaskOutboxSummary, type TaskOutboxSummary } from '@/lib/storage/taskOutbox'
import { normalizeTaskDisplay } from '@yujian/contracts/task-display'

function taskStatus(task: TaskItem) {
  if (task.status) return task.status
  if (task.observation || task.feedback?.completed === '是') return '已完成'
  if (task.feedback?.completed === '否') return '进行中'
  return '待执行'
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [outbox, setOutbox] = useState<TaskOutboxSummary>({ total: 0, pending: 0, failed: 0 })
  const [retryingOutbox, setRetryingOutbox] = useState(false)
  const taskListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setOutbox(getTaskOutboxSummary())
  }, [])

  async function loadTasks() {
    setLoading(true)
    const items = await fetchTasksFromServer()
    setTasks(items.filter((task) => task.status !== '已完成' && task.status !== '已过期').slice(0, 3))
    setOutbox(getTaskOutboxSummary())
    setLoading(false)
  }

  async function handleRetryOutbox() {
    setRetryingOutbox(true)
    try {
      const result = await retryTaskOutboxSync()
      await loadTasks()
      if (result.failed > 0) {
        window.alert('仍有内容未同步，请稍后再试')
      }
    } finally {
      setRetryingOutbox(false)
    }
  }

  useEffect(() => {
    if (!selectedId || !taskListRef.current) return
    const card = taskListRef.current.querySelector(`[data-task-id="${selectedId}"]`)
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  useEffect(() => {
    void loadTasks()
  }, [])

  function toggleTask(taskId: string) {
    setSelectedId((prev) => (prev === taskId ? null : taskId))
  }

  async function handleFeedbackChange(taskId: string, feedback: TaskFeedback, status: string) {
    setSavingId(taskId)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              feedback,
              status,
              observation: feedback.note?.trim() || t.observation,
            }
          : t
      )
    )
    try {
      await updateTaskFeedback(taskId, feedback, status)
      setOutbox(getTaskOutboxSummary())
    } finally {
      setSavingId(null)
    }
  }

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="tasks">
        <section className="section tasks-section-a">
          <h2 className="section-title">今晚待试</h2>
          <p className="tasks-page-lede">
            点卡片展开：先反馈，再读「为什么要试」。
          </p>
          {outbox.failed > 0 ? (
            <div className="task-sync-banner" role="status">
              <p className="task-sync-banner-title">
                有 {outbox.failed} 条任务或反馈还没同步到云端
              </p>
              <button
                type="button"
                className="secondary-button task-sync-banner-btn"
                disabled={retryingOutbox}
                onClick={() => void handleRetryOutbox()}
              >
                {retryingOutbox ? '正在重新同步…' : '点这里重试'}
              </button>
            </div>
          ) : outbox.pending > 0 ? (
            <p className="hint-text task-sync-pending">正在后台同步 {outbox.pending} 条待上传记录</p>
          ) : null}
          <div id="taskList" ref={taskListRef} className="task-list-a">
            {loading ? (
              <p className="hint-text">正在加载…</p>
            ) : tasks.length === 0 ? (
              <p className="hint-text">还没有待试事项。在交流或预演里生成后，会出现在这里。</p>
            ) : (
              tasks.map((task) => {
                const open = selectedId === task.id
                const status = taskStatus(task)
                const variant = taskStatusVariant(status)
                const display = normalizeTaskDisplay(task)
                return (
                  <article
                    key={task.id}
                    className={`task-card-a${open ? ' is-open' : ''}`}
                    data-task-id={task.id}
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => toggleTask(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleTask(task.id)
                      }
                    }}
                  >
                    <div className="task-card-a__head">
                      {display.sceneLabel ? (
                        <p className="task-card-a__scene">{display.sceneLabel}</p>
                      ) : null}
                      <h3 className="task-card-a__headline">{display.headline}</h3>
                      {display.actionHint ? (
                        <p className="task-card-a__hint">{display.actionHint}</p>
                      ) : null}
                      <div className="task-card-a__meta">
                        <span className="task-card-a__source">{display.sourceLine}</span>
                        <div className="task-card-a__meta-end">
                          <span className={`task-card-a__badge status-tag--${variant}`}>{status}</span>
                          <span className="task-card-a__chev" aria-hidden="true">
                            ⌄
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="task-card-a__body">
                      <div className="task-card-a__inner" onClick={(e) => e.stopPropagation()}>
                        <TaskFeedbackPanel
                          task={task}
                          rationale={display.rationale}
                          embedded
                          disabled={savingId === task.id}
                          onFeedbackChange={handleFeedbackChange}
                        />
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

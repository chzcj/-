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
    const panel = taskListRef.current.querySelector(
      `[data-task-id="${selectedId}"] .task-feedback-panel`
    )
    panel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
        <section className="section">
          <h2 className="section-title">今晚待试</h2>
          <p className="hero-copy" style={{ marginTop: 0, marginBottom: 12 }}>
            最近几条来自交流和预演，试过后反馈一下，我会记进记忆。
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
          <div id="taskList" ref={taskListRef}>
            {loading ? (
              <p className="hint-text">正在加载…</p>
            ) : tasks.length === 0 ? (
              <p className="hint-text">还没有待试事项。在交流或预演里生成后，会出现在这里。</p>
            ) : (
              tasks.map((task) => {
                const open = selectedId === task.id
                const status = taskStatus(task)
                const variant = taskStatusVariant(status)
                return (
                  <div key={task.id} className="task-item" data-task-id={task.id}>
                    <div className={`task-card${open ? ' selected' : ''}`}>
                      <p className="task-title">{task.title}</p>
                      <div className="task-meta">
                        <span className="task-source">{task.source || '来自交流'}</span>
                        <button
                          type="button"
                          className={`status-tag status-tag--${variant}${savingId === task.id ? ' saving' : ''}`}
                          aria-expanded={open}
                          aria-label={`${status}，${open ? '收起' : '展开'}反馈`}
                          onClick={() => toggleTask(task.id)}
                        >
                          <span className="status-text">{status}</span>
                          <span
                            className={`status-caret ${open ? 'down' : 'up'}`}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>
                    {open ? (
                      <TaskFeedbackPanel
                        task={task}
                        disabled={savingId === task.id}
                        onFeedbackChange={handleFeedbackChange}
                      />
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { TaskFeedbackPanel, taskStatusVariant } from '@/components/tasks/TaskFeedbackPanel'
import {
  fetchTasksFromServer,
  updateTaskFeedback,
  type TaskFeedback,
  type TaskItem,
} from '@/lib/storage/taskStorage'

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
  const taskListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedId || !taskListRef.current) return
    const panel = taskListRef.current.querySelector(
      `[data-task-id="${selectedId}"] .task-feedback-panel`
    )
    panel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const items = await fetchTasksFromServer()
      setTasks(items)
      setLoading(false)
    })()
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

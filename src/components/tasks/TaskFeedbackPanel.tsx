'use client'

import { useEffect, useRef, useState } from 'react'
import type { TaskFeedback, TaskItem } from '@/lib/storage/taskStorage'

type TaskFeedbackPanelProps = {
  task: TaskItem
  disabled?: boolean
  onFeedbackChange: (taskId: string, feedback: TaskFeedback, status: string) => void | Promise<void>
}

function deriveStatus(feedback: TaskFeedback, fallback: string): string {
  if (feedback.completed === '是') return '已完成'
  if (feedback.completed === '否') return '进行中'
  return fallback
}

export function TaskFeedbackPanel({ task, disabled, onFeedbackChange }: TaskFeedbackPanelProps) {
  const [draft, setDraft] = useState<TaskFeedback>(task.feedback || {})
  const noteTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setDraft(task.feedback || {})
  }, [task.id, task.feedback])

  useEffect(() => {
    return () => {
      if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current)
    }
  }, [])

  function persist(next: TaskFeedback) {
    const status = deriveStatus(next, task.status || '待执行')
    void onFeedbackChange(task.id, next, status)
  }

  function pick(group: keyof TaskFeedback, value: string) {
    if (disabled) return
    const next = { ...draft, [group]: value }
    setDraft(next)
    persist(next)
  }

  function updateNote(note: string) {
    if (disabled) return
    const next = { ...draft, note }
    setDraft(next)
    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current)
    noteTimerRef.current = window.setTimeout(() => persist(next), 400)
  }

  function flushNote() {
    if (noteTimerRef.current) {
      window.clearTimeout(noteTimerRef.current)
      noteTimerRef.current = null
    }
    persist(draft)
  }

  return (
    <div className="feedback-panel task-feedback-panel">
      <p className="feedback-title">任务反馈</p>

      <div className="feedback-group">
        <p className="feedback-question">是否完成？</p>
        <div className="choice-row">
          {['是', '否'].map((value) => (
            <button
              key={value}
              type="button"
              className={`choice-button${draft.completed === value ? ' selected' : ''}`}
              disabled={disabled}
              onClick={() => pick('completed', value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="feedback-group">
        <p className="feedback-question">效果如何？</p>
        <div className="choice-row">
          {['好', '一般', '不好'].map((value) => (
            <button
              key={value}
              type="button"
              className={`choice-button${draft.effect === value ? ' selected' : ''}`}
              disabled={disabled}
              onClick={() => pick('effect', value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="feedback-group">
        <p className="feedback-question">孩子反应？</p>
        <div className="choice-row">
          {['改善', '无变化', '变差'].map((value) => (
            <button
              key={value}
              type="button"
              className={`choice-button${draft.reaction === value ? ' selected' : ''}`}
              disabled={disabled}
              onClick={() => pick('reaction', value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="feedback-group task-feedback-note-group">
        <p className="feedback-question">可选：补充一句</p>
        <textarea
          className="feedback-note"
          placeholder="只记录结果，不编辑任务内容"
          value={draft.note || ''}
          disabled={disabled}
          onChange={(e) => updateNote(e.target.value)}
          onBlur={flushNote}
        />
      </div>
    </div>
  )
}

export function taskStatusVariant(status: string): 'pending' | 'progress' | 'done' {
  if (status === '已完成') return 'done'
  if (status === '进行中') return 'progress'
  return 'pending'
}

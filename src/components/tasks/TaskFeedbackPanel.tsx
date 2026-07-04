'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TaskFeedback, TaskItem } from '@/lib/storage/taskStorage'

type TaskFeedbackPanelProps = {
  task: TaskItem
  disabled?: boolean
  onSubmit: (taskId: string, feedback: TaskFeedback, status: string) => void | Promise<void>
  onBackToList?: () => void
}

function deriveStatus(feedback: TaskFeedback, fallback: string): string {
  if (feedback.completed === '是') return '已完成'
  if (feedback.completed === '否') return '进行中'
  return fallback
}

function feedbackEqual(a: TaskFeedback | undefined, b: TaskFeedback): boolean {
  const left = a || {}
  return (
    (left.completed || '') === (b.completed || '') &&
    (left.effect || '') === (b.effect || '') &&
    (left.reaction || '') === (b.reaction || '') &&
    (left.note || '').trim() === (b.note || '').trim()
  )
}

export function TaskFeedbackPanel({ task, disabled, onSubmit, onBackToList }: TaskFeedbackPanelProps) {
  const saved = task.feedback || {}
  const [draft, setDraft] = useState<TaskFeedback>(saved)
  const [dockRoot, setDockRoot] = useState<Element | null>(null)

  useEffect(() => {
    setDockRoot(document.querySelector('.hifi-app-root .app-shell'))
  }, [])

  useEffect(() => {
    setDraft(task.feedback || {})
  }, [task.id, task.feedback])

  const dirty = !feedbackEqual(task.feedback, draft)
  const alreadySaved = !dirty && Boolean(task.feedback?.completed)
  const canSubmit = Boolean(draft.completed) && !alreadySaved && !disabled

  function pick(group: keyof TaskFeedback, value: string) {
    if (disabled) return
    setDraft((prev) => ({ ...prev, [group]: value }))
  }

  function updateNote(note: string) {
    if (disabled) return
    setDraft((prev) => ({ ...prev, note }))
  }

  function handleBack() {
    onBackToList?.()
  }

  async function handleSubmit() {
    if (!canSubmit) return
    const status = deriveStatus(draft, task.status || '待执行')
    await onSubmit(task.id, draft, status)
    onBackToList?.()
  }

  function handleDockClick() {
    if (alreadySaved) {
      handleBack()
      return
    }
    void handleSubmit()
  }

  const dockLabel = disabled ? '提交中…' : alreadySaved ? '回到任务界面' : '确认提交反馈'
  const dockDisabled = disabled || (!alreadySaved && !draft.completed)

  const submitDock =
    dockRoot &&
    createPortal(
      <div className="task-submit-dock" role="region" aria-label="提交任务反馈">
        {!draft.completed && !alreadySaved ? (
          <p className="task-submit-hint">请先选择「是否完成」</p>
        ) : null}
        <button
          type="button"
          className={`${alreadySaved ? 'secondary-button' : 'primary-button'} task-submit-button wide-button`}
          disabled={dockDisabled}
          onClick={handleDockClick}
        >
          {dockLabel}
        </button>
      </div>,
      dockRoot
    )

  return (
    <>
      <div className="feedback-panel task-feedback-panel">
        <div className="task-feedback-toolbar">
          <button
            type="button"
            className="task-feedback-back"
            onClick={handleBack}
            aria-label="回到任务界面"
          >
            <span className="task-feedback-back-icon" aria-hidden="true">
              ←
            </span>
            回到任务界面
          </button>
          {alreadySaved ? <span className="task-feedback-saved-tag">已反馈</span> : null}
        </div>

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
          />
        </div>
      </div>
      {submitDock}
    </>
  )
}

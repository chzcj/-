'use client'

import { useEffect, useState } from 'react'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { getChildDisplayName } from '@/lib/storage/childStorage'
import type { TaskFeedback, TaskItem } from '@/lib/storage/taskStorage'

type TaskFeedbackPanelProps = {
  task: TaskItem
  rationale?: string
  disabled?: boolean
  embedded?: boolean
  onFeedbackChange: (taskId: string, feedback: TaskFeedback, status: string) => void | Promise<void>
}

function deriveStatus(feedback: TaskFeedback, fallback: string): string {
  if (feedback.completed === '是') return '已完成'
  if (feedback.completed === '否') return '进行中'
  return fallback
}

const COMPLETED_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '做了', value: '是' },
  { label: '还没', value: '否' },
]

const EFFECT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '有松动', value: '好' },
  { label: '差不多', value: '一般' },
  { label: '更僵了', value: '不好' },
]

export function TaskFeedbackPanel({
  task,
  rationale,
  disabled,
  embedded,
  onFeedbackChange,
}: TaskFeedbackPanelProps) {
  const copy = childSystemCopy(getChildDisplayName())
  const [draft, setDraft] = useState<TaskFeedback>(task.feedback || {})
  const [moreOpen, setMoreOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(task.feedback?.note || '')

  useEffect(() => {
    setDraft(task.feedback || {})
    setNoteDraft(task.feedback?.note || '')
  }, [task.id, task.feedback])

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

  function submitSupplement() {
    if (disabled) return
    const next = { ...draft, note: noteDraft.trim() }
    setDraft(next)
    persist(next)
    window.alert(copy.supplementSaved)
  }

  const whyText =
    rationale?.trim() ||
    task.rationale?.trim() ||
    '还在根据你们的交流补全；先试一次，反馈会帮我记进记忆。'

  return (
    <div className={`feedback-panel task-feedback-panel${embedded ? ' task-feedback-panel--embedded' : ''}`}>
      <div className="feedback-block">
        <p className="feedback-label">试过了吗？</p>
        <div className="choice-row">
          {COMPLETED_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={`task-chip${draft.completed === value ? ' selected' : ''}`}
              disabled={disabled}
              onClick={() => pick('completed', value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="feedback-label">效果怎么样？</p>
        <div className="choice-row">
          {EFFECT_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={`task-chip${draft.effect === value ? ' selected' : ''}`}
              disabled={disabled}
              onClick={() => pick('effect', value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="task-why-block">
        <p className="task-why-kicker">为什么要试这个</p>
        <p className="task-why-body">{whyText}</p>
      </div>

      <button
        type="button"
        className="task-feedback-more-toggle"
        onClick={() => setMoreOpen((v) => !v)}
      >
        {moreOpen ? '收起补充项 ▾' : `${copy.supplementReaction} ▸`}
      </button>
      {moreOpen ? (
        <div className="task-feedback-more">
          <div className="feedback-group">
            <p className="feedback-question">{copy.reactionQuestion}</p>
            <div className="choice-row">
              {['改善', '无变化', '变差'].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`task-chip${draft.reaction === value ? ' selected' : ''}`}
                  disabled={disabled}
                  onClick={() => pick('reaction', value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="feedback-group task-feedback-note-group">
            <textarea
              className="feedback-note"
              placeholder="只记录结果，不编辑任务内容"
              value={noteDraft}
              disabled={disabled}
              onChange={(e) => setNoteDraft(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="primary-button block task-feedback-submit"
            disabled={disabled}
            onClick={submitSupplement}
          >
            {copy.saveSupplement}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function taskStatusVariant(status: string): 'pending' | 'progress' | 'done' {
  if (status === '已完成') return 'done'
  if (status === '进行中') return 'progress'
  return 'pending'
}

import { View, Text, Textarea } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import type { TaskFeedback, TaskItem } from '@/services/taskStorage'
import './TaskFeedbackPanel.scss'

export type { TaskFeedback, TaskItem }

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

function TaskChip({
  label,
  selected,
  disabled,
  onPick,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  onPick: () => void
}) {
  return (
    <View
      className={`task-chip${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
      hoverClass='none'
      catchClick={onPick}
    >
      <Text className='task-chip__label'>{label}</Text>
    </View>
  )
}

export function TaskFeedbackPanel({
  task,
  rationale,
  disabled,
  embedded,
  onFeedbackChange,
}: TaskFeedbackPanelProps) {
  const [draft, setDraft] = useState<TaskFeedback>(task.feedback || {})
  const [moreOpen, setMoreOpen] = useState(false)
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDraft(task.feedback || {})
  }, [task.id, task.feedback])

  useEffect(() => {
    return () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
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
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
    noteTimerRef.current = setTimeout(() => persist(next), 400)
  }

  function flushNote() {
    if (noteTimerRef.current) {
      clearTimeout(noteTimerRef.current)
      noteTimerRef.current = null
    }
    persist(draft)
  }

  const whyText =
    rationale?.trim() ||
    task.rationale?.trim() ||
    '还在根据你们的交流补全；先试一次，反馈会帮我记进记忆。'

  return (
    <View className={`feedback-panel task-feedback-panel${embedded ? ' task-feedback-panel--embedded' : ''}`}>
      <View className='feedback-block'>
        <Text className='feedback-label'>试过了吗？</Text>
        <View className='choice-row'>
          {COMPLETED_OPTIONS.map(({ label, value }) => (
            <TaskChip
              key={value}
              label={label}
              selected={draft.completed === value}
              disabled={disabled}
              onPick={() => pick('completed', value)}
            />
          ))}
        </View>
        <Text className='feedback-label'>效果怎么样？</Text>
        <View className='choice-row'>
          {EFFECT_OPTIONS.map(({ label, value }) => (
            <TaskChip
              key={value}
              label={label}
              selected={draft.effect === value}
              disabled={disabled}
              onPick={() => pick('effect', value)}
            />
          ))}
        </View>
      </View>

      <View className='task-why-block'>
        <Text className='task-why-kicker'>为什么要试这个</Text>
        <Text className='task-why-body'>{whyText}</Text>
      </View>

      <Text
        className='task-feedback-more-toggle'
        onClick={() => setMoreOpen((v) => !v)}
      >
        {moreOpen ? '收起补充项 ▾' : '补充孩子反应或一句备注 ▸'}
      </Text>
      {moreOpen ? (
        <View className='task-feedback-more'>
          <View className='feedback-group'>
            <Text className='feedback-question'>孩子反应？</Text>
            <View className='choice-row'>
              {['改善', '无变化', '变差'].map((value) => (
                <TaskChip
                  key={value}
                  label={value}
                  selected={draft.reaction === value}
                  disabled={disabled}
                  onPick={() => pick('reaction', value)}
                />
              ))}
            </View>
          </View>
          <View className='feedback-group task-feedback-note-group'>
            <Textarea
              className='feedback-note'
              placeholder='只记录结果，不编辑任务内容'
              value={draft.note || ''}
              disabled={disabled}
              onInput={(e) => updateNote(e.detail.value)}
              onBlur={flushNote}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}

export function taskStatusVariant(status: string): 'pending' | 'progress' | 'done' {
  if (status === '已完成') return 'done'
  if (status === '进行中') return 'progress'
  return 'pending'
}

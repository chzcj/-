import { View, Text, Textarea } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import type { TaskFeedback, TaskItem } from '@/services/taskStorage'
import './TaskFeedbackPanel.scss'

export type { TaskFeedback, TaskItem }

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

  return (
    <View className='feedback-panel task-feedback-panel'>
      <Text className='feedback-title'>任务反馈</Text>
      <View className='feedback-group'>
        <Text className='feedback-question'>是否完成？</Text>
        <View className='choice-row'>
          {['是', '否'].map((value) => (
            <Text
              key={value}
              className={`choice-button${draft.completed === value ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
              onClick={() => pick('completed', value)}
            >
              {value}
            </Text>
          ))}
        </View>
      </View>
      <View className='feedback-group'>
        <Text className='feedback-question'>效果如何？</Text>
        <View className='choice-row'>
          {['好', '一般', '不好'].map((value) => (
            <Text
              key={value}
              className={`choice-button${draft.effect === value ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
              onClick={() => pick('effect', value)}
            >
              {value}
            </Text>
          ))}
        </View>
      </View>
      <View className='feedback-group'>
        <Text className='feedback-question'>孩子反应？</Text>
        <View className='choice-row'>
          {['改善', '无变化', '变差'].map((value) => (
            <Text
              key={value}
              className={`choice-button${draft.reaction === value ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
              onClick={() => pick('reaction', value)}
            >
              {value}
            </Text>
          ))}
        </View>
      </View>
      <View className='feedback-group task-feedback-note-group'>
        <Text className='feedback-question'>可选：补充一句</Text>
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
  )
}

export function taskStatusVariant(status: string): 'pending' | 'progress' | 'done' {
  if (status === '已完成') return 'done'
  if (status === '进行中') return 'progress'
  return 'pending'
}

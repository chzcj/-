import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { useTabBar } from '@/hooks/useTabBar'
import { TaskFeedbackPanel, taskStatusVariant } from '@/components/tasks/TaskFeedbackPanel'
import { fetchCurrentUser } from '@/services/auth'
import {
  fetchTasksFromServer,
  updateTaskFeedback,
  type TaskFeedback,
  type TaskItem,
} from '@/services/taskStorage'
import { requireOnboardingComplete } from '@/utils/navigation'
import './index.scss'

function taskStatus(task: TaskItem) {
  if (task.status) return task.status
  if (task.observation || task.feedback?.completed === '是') return '已完成'
  if (task.feedback?.completed === '否') return '进行中'
  return '待执行'
}

export default function TasksPage() {
  useTabBar('tasks')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadTasks = async () => {
    setLoading(true)
    const items = await fetchTasksFromServer()
    setTasks(items)
    setLoading(false)
  }

  useDidShow(async () => {
    const user = await fetchCurrentUser()
    if (!requireOnboardingComplete(user)) return
    await loadTasks()
  })

  const toggleTask = (taskId: string) => {
    setSelectedId((prev) => (prev === taskId ? null : taskId))
  }

  const handleFeedbackChange = async (taskId: string, feedback: TaskFeedback, status: string) => {
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
    <HiFiMainShell surface='white'>
      <Text className='hero-title page-heading'>今晚待试</Text>
      <Text className='hero-copy muted'>
        最近几条来自交流和预演，试过后反馈一下，我会记进记忆。
      </Text>

      {loading ? (
        <View className='loading-wrap'>
          <View className='loader' />
          <Text className='muted'>正在加载…</Text>
        </View>
      ) : tasks.length === 0 ? (
        <Text className='muted empty-hint'>
          还没有待试事项。在交流或预演里生成后，会出现在这里。
        </Text>
      ) : (
        tasks.map((task) => {
          const open = selectedId === task.id
          const status = taskStatus(task)
          const variant = taskStatusVariant(status)
          const saving = savingId === task.id
          return (
            <View key={task.id} className='task-item'>
              <View className={`task-card hifi-card${open ? ' selected' : ''}`}>
                <Text className='task-title'>{task.title}</Text>
                <View className='task-meta'>
                  <Text className='task-source'>{task.source || '来自交流'}</Text>
                  <Text
                    className={`status-tag status-tag--${variant}${saving ? ' saving' : ''}`}
                    onClick={() => toggleTask(task.id)}
                  >
                    <Text className='status-text'>{status}</Text>
                    <Text className={`status-caret ${open ? 'down' : 'up'}`}>›</Text>
                  </Text>
                </View>
              </View>
              {open ? (
                <TaskFeedbackPanel
                  task={task}
                  disabled={saving}
                  onFeedbackChange={handleFeedbackChange}
                />
              ) : null}
            </View>
          )
        })
      )}
    </HiFiMainShell>
  )
}

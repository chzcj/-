import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { useTabBar } from '@/hooks/useTabBar'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { SHARE_PATHS } from '@/lib/shareMessages'
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
  if (task.feedback?.completed === '是') return '已完成'
  if (task.feedback?.completed === '否') return '进行中'
  return '待执行'
}

function taskSubtitle(task: TaskItem): string {
  const source = task.source || '来自交流'
  const scene = (task.observation || '').replace(/^来自交流\s*·\s*/, '').trim()
  if (scene && scene !== source) {
    const short = scene.slice(0, 28)
    return `${source} · ${short}${scene.length > 28 ? '…' : ''}`
  }
  if (task.observation?.includes('·')) return task.observation.slice(0, 40)
  return source
}


export default function TasksPage() {
  useTabBar('tasks')
  usePublicPageShare({
    title: '育见 · 今晚待试的小步骤',
    path: SHARE_PATHS.tasks,
  })
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
    <HiFiMainShell>
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
        <View className='empty-state'>
          <Text className='muted empty-hint'>
            还没有待试事项。在交流里点「保存为今晚任务」，或去预演生成后，会出现在这里。
          </Text>
          <Text
            className='pill primary block empty-cta'
            onClick={() => void Taro.switchTab({ url: '/pages/daily/index' })}
          >
            去交流页试试
          </Text>
        </View>
      ) : (
        tasks.map((task) => {
          const open = selectedId === task.id
          const status = taskStatus(task)
          const variant = taskStatusVariant(status)
          const saving = savingId === task.id
          return (
            <View key={task.id} className='task-item'>
              <View
                className={`task-card hifi-card${open ? ' selected open' : ''}`}
                onClick={() => toggleTask(task.id)}
              >
                <Text className='task-title'>{task.title}</Text>
                <Text className='task-subtitle muted'>{taskSubtitle(task)}</Text>
                <View className='task-meta'>
                  <Text className='task-source'>{task.source || '来自交流'}</Text>
                  <Text
                    className={`status-tag status-tag--${variant}${saving ? ' saving' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleTask(task.id)
                    }}
                  >
                    <Text className='status-text'>{open ? '收起' : status}</Text>
                    <Text className={`status-caret ${open ? 'down' : 'up'}`}>›</Text>
                  </Text>
                </View>
                {open ? <Text className='task-collapse-hint'>点击卡片任意处可收起</Text> : null}
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

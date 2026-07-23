import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { useTabBar } from '@/hooks/useTabBar'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { normalizeTaskDisplay } from '@yujian/contracts/task-display'
import { TaskFeedbackPanel, taskStatusVariant } from '@/components/tasks/TaskFeedbackPanel'
import { fetchCurrentUser } from '@/services/auth'
import {
  fetchTasksFromServer,
  updateTaskFeedback,
  retryTaskOutboxSync,
  type TaskFeedback,
  type TaskItem,
} from '@/services/taskStorage'
import { getTaskOutboxSummary, type TaskOutboxSummary } from '@/services/taskOutbox'
import { requireOnboardingComplete } from '@/utils/navigation'
import './index.scss'

function taskStatus(task: TaskItem) {
  if (task.status) return task.status
  if (task.feedback?.completed === '是') return '已完成'
  if (task.feedback?.completed === '否') return '进行中'
  return '待执行'
}

export default function TasksPage() {
  useTabBar('tasks')
  usePublicPageShare({
    title: '育见 · 今晚待试的小步骤',
    path: SHARE_PATHS.tasks,
  })
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [history, setHistory] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [outbox, setOutbox] = useState<TaskOutboxSummary>(() => getTaskOutboxSummary())
  const [retryingOutbox, setRetryingOutbox] = useState(false)

  const loadTasks = async () => {
    setLoading(true)
    const items = await fetchTasksFromServer()
    setTasks(items.current)
    setHistory(items.history)
    setOutbox(getTaskOutboxSummary())
    setLoading(false)
  }

  const handleRetryOutbox = async () => {
    setRetryingOutbox(true)
    try {
      const result = await retryTaskOutboxSync()
      await loadTasks()
      if (result.failed > 0) {
        Taro.showToast({ title: '仍有内容未同步', icon: 'none' })
      } else if (result.synced > 0) {
        Taro.showToast({ title: '已同步到云端', icon: 'success' })
      } else {
        Taro.showToast({ title: '暂无可同步内容', icon: 'none' })
      }
    } finally {
      setRetryingOutbox(false)
    }
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
      setOutbox(getTaskOutboxSummary())
    } finally {
      setSavingId(null)
    }
  }

  return (
    <HiFiMainShell>
      <View className='tasks-section-a'>
        <Text className='tasks-page-title'>今晚待试</Text>
        <Text className='tasks-page-lede'>
          点卡片展开：先反馈，再读「为什么要试」。
        </Text>

      {outbox.failed > 0 ? (
        <View className='task-sync-banner' onClick={() => void handleRetryOutbox()}>
          <Text className='task-sync-banner-title'>
            {retryingOutbox ? '正在重新同步…' : `有 ${outbox.failed} 条任务或反馈还没同步到云端`}
          </Text>
          <Text className='task-sync-banner-action muted'>
            {retryingOutbox ? '请稍候' : '点这里重试'}
          </Text>
        </View>
      ) : outbox.pending > 0 ? (
        <View className='task-sync-banner task-sync-banner--pending'>
          <Text className='task-sync-banner-title muted'>正在后台同步 {outbox.pending} 条待上传记录</Text>
        </View>
      ) : null}

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
        <>
          <View className='task-list-a'>
            {tasks.map((task) => {
              const open = selectedId === task.id
              const status = taskStatus(task)
              const variant = taskStatusVariant(status)
              const saving = savingId === task.id
              const display = normalizeTaskDisplay(task)
              return (
                <View
                  key={task.id}
                  className={`task-card-a${open ? ' is-open' : ''}${saving ? ' is-saving' : ''}`}
                  onClick={() => toggleTask(task.id)}
                >
                  <View className='task-card-a__head'>
                    {display.sceneLabel ? (
                      <Text className='task-card-a__scene'>{display.sceneLabel}</Text>
                    ) : null}
                    <Text className='task-card-a__headline'>{display.headline}</Text>
                    {display.actionHint ? (
                      <Text className='task-card-a__hint'>{display.actionHint}</Text>
                    ) : null}
                    <View className='task-card-a__meta'>
                      <Text className='task-card-a__source'>{display.sourceLine}</Text>
                      <View className='task-card-a__meta-end'>
                        <Text className={`task-card-a__badge status-tag--${variant}`}>{status}</Text>
                        <View className='task-card-a__chev'>
                          <Text className='task-card-a__chev-icon'>⌄</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View className='task-card-a__body'>
                    <View className='task-card-a__inner' catchClick>
                      <TaskFeedbackPanel
                        task={task}
                        rationale={display.rationale}
                        embedded
                        disabled={saving}
                        onFeedbackChange={handleFeedbackChange}
                      />
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
          {history.length ? (
            <View className='task-history'>
              <Text className='section-label' onClick={() => setHistoryOpen((value) => !value)}>
                已完成与过去尝试 {historyOpen ? '▾' : '▸'}
              </Text>
              {historyOpen
                ? history.map((task) => {
                    const display = normalizeTaskDisplay(task)
                    return (
                      <View key={task.id} className='task-history-row'>
                        <Text className='task-title'>{display.headline}</Text>
                        <Text className='task-subtitle muted'>{taskStatus(task)}</Text>
                      </View>
                    )
                  })
                : null}
            </View>
          ) : null}
        </>
      )}
      </View>
    </HiFiMainShell>
  )
}

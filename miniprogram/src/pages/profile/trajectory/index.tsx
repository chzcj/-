import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { apiRequest } from '@/services/api'
import './index.scss'

type TrajectoryEntry = {
  entryId: string
  occurredAt: string
  title: string
  summary: string
  sourceTypes: string[]
}

type Trajectory = {
  summary: string
  entries: TrajectoryEntry[]
  updatedAt: string
}

function formatDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export default function GrowthTrajectoryPage() {
  useSafeShareAppMessage({ title: '育见 · 成长轨迹' })
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const res = await apiRequest<{ trajectory?: Trajectory | null; refreshing?: boolean }>('/api/profile/trajectory', {
      method: 'GET',
    })
    if (res.ok) {
      setTrajectory(res.data.trajectory || null)
      setRefreshing(Boolean(res.data.refreshing))
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 8000)
    return () => clearInterval(timer)
  }, [])

  const groups = useMemo(() => {
    const byDay = new Map<string, TrajectoryEntry[]>()
    for (const entry of trajectory?.entries || []) {
      const day = formatDay(entry.occurredAt)
      byDay.set(day, [...(byDay.get(day) || []), entry])
    }
    return [...byDay.entries()]
  }, [trajectory])

  return (
    <View className='trajectory-page'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title='成长轨迹'
        showClose
        onBack={() => void Taro.navigateBack()}
        onClose={() => void Taro.switchTab({ url: '/pages/profile/index' })}
      />
      <ScrollView scrollY className='trajectory-scroll'>
        {loading && !trajectory ? (
          <View className='trajectory-state'>
            <View className='loader' />
            <Text className='muted'>正在整理成长记录…</Text>
          </View>
        ) : null}
        {refreshing ? <Text className='trajectory-refreshing'>正在整理新的成长记录，上一版内容仍可查看。</Text> : null}
        {trajectory ? (
          <>
            <View className='trajectory-hero'>
              <Text className='trajectory-hero-kicker'>家庭成长手账</Text>
              <Text className='trajectory-hero-summary'>{trajectory.summary}</Text>
              <Text className='trajectory-hero-meta'>已沉淀 {trajectory.entries.length} 个成长节点</Text>
            </View>
            {groups.map(([day, entries]) => (
              <View key={day} className='trajectory-day'>
                <Text className='trajectory-day-title'>{day}</Text>
                {entries.map((entry) => (
                  <View key={entry.entryId} className='trajectory-entry'>
                    <Text className='trajectory-entry-source'>{entry.sourceTypes.join(' · ')}</Text>
                    <Text className='trajectory-entry-title'>{entry.title}</Text>
                    <Text className='trajectory-entry-summary'>{entry.summary}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : !loading ? (
          <View className='trajectory-state'>
            <Text className='section-label'>成长轨迹正在准备</Text>
            <Text className='muted'>继续交流、完成任务或进行预演后，这里会逐步沉淀你们家的成长记录。</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

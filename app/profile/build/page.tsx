'use client'

import { ArrowRight, Camera, CheckCircle2, ChevronRight, Eye, Lightbulb, MessageCircle, Mic, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { entryConfigs } from '@/data/entryConfig'
import { getAllEntryStatuses, getEntryStatus } from '@/lib/storage/entryStorage'
import type { BuildEntryStatus, EntryType } from '@/types/storage'

const statusLabels: Record<BuildEntryStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
}

export default function ProfileBuildPage() {
  const router = useRouter()
  const [statuses, setStatuses] = useState<Record<EntryType, BuildEntryStatus>>(
    {} as Record<EntryType, BuildEntryStatus>
  )

  useEffect(() => {
    setStatuses(getAllEntryStatuses())
  }, [])

  function refreshStatuses() {
    setStatuses(getAllEntryStatuses())
  }

  useEffect(() => {
    refreshStatuses()
  }, [router])

  const allCompleted = entryConfigs.every((e) => statuses[e.type] === 'completed')

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="建立孩子画像" showBack onBack={() => router.push('/home')} />

        <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 16, lineHeight: 1.6 }}>
          先收 5 类真实片段，再生成孩子画像
        </div>

        <div className="stack" style={{ marginBottom: 16 }}>
          {entryConfigs.map((entry) => {
            const status = statuses[entry.type] || 'not_started'
            const iconEl =
              entry.type === 'study' ? <Lightbulb size={22} /> :
              entry.type === 'routine' ? <Eye size={22} /> :
              entry.type === 'communication' ? <MessageCircle size={22} /> :
              entry.type === 'emotion' ? <Camera size={22} /> :
              <Users size={22} />
            return (
              <button
                key={entry.type}
                type="button"
                className="entry-card"
                onClick={() => router.push(`/profile/build/${entry.type}`)}
              >
                <div className="icon-box">{iconEl}</div>
                <span className="entry-title" style={{ display: 'block' }}>
                  {entry.title}
                  {status === 'completed' ? (
                    <span style={{ color: '#4f9f72', fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
                      <CheckCircle2 size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 3 }} />
                      已完成
                    </span>
                  ) : null}
                </span>
                <ChevronRight size={18} color="#A1A1A6" />
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: 13, color: '#A1A1A6', textAlign: 'center', marginBottom: 20 }}>
          不用分析原因 讲真实片段就行
        </div>

        {allCompleted ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => router.push('/profile/build/final-follow-up')}
            style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}
          >
            生成孩子画像
            <ArrowRight size={18} style={{ marginLeft: 6 }} />
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => router.push('/profile/build/study')}
            style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}
          >
            从学习与作业开始
          </button>
        )}

        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}

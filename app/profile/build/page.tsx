'use client'

import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2, ChevronRight, Eye, Lightbulb, MessageCircle, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { HiFiBuildHero } from '@/components/profile/HiFiBuildHero'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { entryConfigs } from '@/data/entryConfig'
import { BUILD_ENTRY_COUNT } from '@/data/entryConfig'
import { isOnboardingComplete } from '@/lib/profile/onboarding'
import { getChildDisplayName } from '@/lib/storage/childStorage'
import { getAllEntryStatuses } from '@/lib/storage/entryStorage'
import type { BuildEntryType } from '@/lib/profile/buildEntries'
import type { BuildEntryStatus } from '@/types/storage'

const statusLabels: Record<BuildEntryStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
}

const entryIcons: Record<BuildEntryType, ReactNode> = {
  daily: <Eye size={22} />,
  homework: <Lightbulb size={22} />,
  communication: <MessageCircle size={22} />,
  family: <Users size={22} />,
}

export default function ProfileBuildPage() {
  const router = useRouter()
  const onboarding = !isOnboardingComplete()
  const [childName, setChildName] = useState('孩子')
  const [statuses, setStatuses] = useState(() => getAllEntryStatuses())

  useEffect(() => {
    const syncChild = () => setChildName(getChildDisplayName())
    syncChild()
    window.addEventListener('focus', syncChild)
    return () => window.removeEventListener('focus', syncChild)
  }, [])

  useEffect(() => {
    setStatuses(getAllEntryStatuses())
  }, [])

  const completedCount = useMemo(
    () => entryConfigs.filter((e) => statuses[e.type] === 'completed').length,
    [statuses]
  )
  const allCompleted = completedCount === BUILD_ENTRY_COUNT
  const nextEntry = entryConfigs.find((e) => statuses[e.type] !== 'completed')

  return (
    <HiFiBuildShell
      topTitle={onboarding ? `认识${childName}` : '补充画像'}
      stepLabel={`四模块 · ${completedCount}/${BUILD_ENTRY_COUNT}`}
      progress={28 + completedCount * 14}
      onBack={onboarding ? undefined : () => router.push('/family-profile')}
      actions={
        allCompleted
          ? [
              {
                label: onboarding ? '四模块够了，生成孩子画像' : '更新孩子画像',
                icon: <ArrowRight size={18} />,
                onClick: () => router.push('/profile/build/final-follow-up'),
              },
            ]
          : nextEntry
            ? [
                {
                  label: onboarding ? `从${nextEntry.title}开始` : '继续补充',
                  icon: <ArrowRight size={18} />,
                  onClick: () => router.push(`/profile/build/${nextEntry.type}`),
                },
              ]
            : []
      }
    >
      <HiFiBuildHero
        kicker={onboarding ? '开始使用育见' : '补充画像'}
        title={onboarding ? `讲四个模块的真实片段，建立${childName}的画像` : '补充更多真实片段'}
        copy={
          onboarding
            ? '每类大约 3～5 分钟，尽量讲 30 秒以上的真实过程。日常 → 作业 → 沟通 → 家庭，按顺序完成即可。'
            : '不用分析原因，讲真实片段就行。'
        }
      />

      <section className="section">
        <p className="section-title">四模块 · {completedCount}/{BUILD_ENTRY_COUNT}</p>
        <div className="entry-list">
          {entryConfigs.map((entry) => {
            const status = statuses[entry.type] || 'not_started'
            return (
              <button
                key={entry.type}
                type="button"
                className={`entry-row${status === 'completed' ? ' completed' : ''}`}
                onClick={() => router.push(`/profile/build/${entry.type}`)}
              >
                <span className="entry-icon">{entryIcons[entry.type]}</span>
                <span className="entry-copy">
                  <span className="entry-title">
                    {entry.title}
                    <span className={`entry-status status-${status}`}>
                      {status === 'completed' ? (
                        <>
                          <CheckCircle2 size={14} />
                          已完成
                        </>
                      ) : (
                        statusLabels[status]
                      )}
                    </span>
                  </span>
                  <span className="entry-desc">{entry.hubDesc}</span>
                </span>
                <ChevronRight size={18} color="var(--muted)" />
              </button>
            )
          })}
        </div>
      </section>
    </HiFiBuildShell>
  )
}

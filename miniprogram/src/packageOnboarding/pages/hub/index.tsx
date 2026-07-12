import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { BUILD_ENTRY_COUNT, firstBuildEntryPath, mpCapturePath, type BuildEntryType } from '@/lib/buildEntries'
import { mpGoReplace, exitSupplementToProfile } from '@/lib/mpOnboardingNav'
import { entryConfigs } from '@/data/entryConfig'
import { getAllEntryStatuses, setSupplementFlow } from '@/services/entryStorage'
import { loadChildBasicInfo } from '@/services/childStorage'
import { allModulesCompleted } from '@/services/entryStorage'
import './index.scss'

const STATUS_LABEL = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
} as const

export default function OnboardingHub() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })
  const [statuses, setStatuses] = useState(getAllEntryStatuses())
  const childName = loadChildBasicInfo().childName || '孩子'

  useDidShow(() => setStatuses(getAllEntryStatuses()))

  const completedCount = useMemo(
    () => entryConfigs.filter((e) => statuses[e.type] === 'completed').length,
    [statuses]
  )
  const allDone = allModulesCompleted()
  const nextEntry = entryConfigs.find((e) => statuses[e.type] !== 'completed')

  const openEntry = (entryType: BuildEntryType, status: string) => {
    const supplement = status === 'completed'
    if (supplement) setSupplementFlow(true)
    void mpGoReplace(mpCapturePath(entryType, supplement))
  }

  const actions = allDone
    ? [{ label: '四模块够了，生成孩子画像', onClick: () => void mpGoReplace('/packageOnboarding/pages/final-follow-up/index') }]
    : nextEntry
      ? [{ label: `从${nextEntry.title}开始`, onClick: () => void mpGoReplace(mpCapturePath(nextEntry.type)) }]
      : []

  return (
    <HiFiBuildShell
      topTitle={`认识${childName}`}
      stepLabel={`四模块 · ${completedCount}/${BUILD_ENTRY_COUNT}`}
      progress={28 + completedCount * 14}
      actions={actions}
      deepNav={{
        title: `认识${childName}`,
        onBack: exitSupplementToProfile,
        onExit: exitSupplementToProfile,
      }}
    >
      <HiFiBuildHero
        kicker='开始使用育见'
        title={`讲四个模块的真实片段，建立${childName}的画像`}
        copy='每类大约 3～5 分钟，尽量讲 30 秒以上的真实过程。日常 → 作业 → 沟通 → 家庭，按顺序完成即可。'
      />
      <Text className='section-label'>四模块 · {completedCount}/{BUILD_ENTRY_COUNT}</Text>
      <View className='entry-list'>
        {entryConfigs.map((entry) => {
          const status = statuses[entry.type]
          return (
            <View
              key={entry.type}
              className={`entry-row${status === 'completed' ? ' completed' : ''}`}
              onClick={() => openEntry(entry.type as BuildEntryType, status)}
            >
              <View className='entry-row-main'>
                <Text className='entry-row-title'>{entry.title}</Text>
                <Text className='entry-row-desc'>{entry.hubDesc}</Text>
              </View>
              <Text className='entry-row-status'>{STATUS_LABEL[status]}</Text>
            </View>
          )
        })}
      </View>
      {!nextEntry && !allDone ? (
        <View onClick={() => void mpGoReplace(firstBuildEntryPath())}>
          <Text className='pill primary'>从第一模块开始</Text>
        </View>
      ) : null}
    </HiFiBuildShell>
  )
}

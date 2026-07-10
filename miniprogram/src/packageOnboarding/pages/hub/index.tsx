import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { BUILD_ENTRY_COUNT, firstBuildEntryPath, mpCapturePath, type BuildEntryType } from '@/lib/buildEntries'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { entryConfigs } from '@/data/entryConfig'
import { getAllEntryStatuses } from '@/services/entryStorage'
import { loadChildBasicInfo } from '@/services/childStorage'
import { allModulesCompleted } from '@/services/entryStorage'

const STATUS_LABEL = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
} as const

export default function OnboardingHub() {
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
    const go = () => void mpGoReplace(mpCapturePath(entryType))
    if (status === 'completed') {
      Taro.showModal({
        title: '重新填写本模块？',
        content: '重填会清空本模块已整理的结果，需要重新采集与确认。',
        confirmText: '继续重填',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) go()
        },
      })
      return
    }
    go()
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
              <View>
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

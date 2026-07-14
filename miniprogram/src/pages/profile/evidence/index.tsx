import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { humanizeEntryRef, humanizeMechanismLabel } from '@/lib/entry-name-i18n'
import {
  fetchChipPanelsFromHub,
  readCachedChipPanels,
  type ChipEvidenceItem,
} from '@/lib/profileChipPanels'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { getLatestProfile, hasProfile } from '@/services/profileStorage'
import './index.scss'

export default function ProfileEvidencePage() {
  usePublicPageShare({
    title: '育见 · 画像从哪来',
    path: SHARE_PATHS.profileEvidence,
  })
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ChipEvidenceItem[]>(() => {
    const cached = readCachedChipPanels()?.evidenceItems
    if (cached?.length) return cached
    return getLatestProfile()?.evidence || []
  })

  useDidShow(() => {
    void (async () => {
      const cached = readCachedChipPanels()?.evidenceItems
      if (cached?.length) setItems(cached)

      const { panels } = await fetchChipPanelsFromHub()
      if (panels?.evidenceItems?.length) {
        setItems(panels.evidenceItems)
      } else if (!items.length) {
        setItems(getLatestProfile()?.evidence || [])
      }
      setLoading(false)
    })()
  })

  if (loading && !items.length) {
    return (
      <HiFiMainShell showInput={false}>
        <View className='loading-wrap'>
          <View className='loader' />
          <Text className='muted'>正在整理判断依据…</Text>
        </View>
      </HiFiMainShell>
    )
  }

  if (!hasProfile() && !items.length) {
    return (
      <HiFiMainShell showInput={false}>
        <Text className='pill' onClick={() => Taro.navigateBack()}>
          ← 返回
        </Text>
        <View className='hifi-card profile-block'>
          <Text className='section-label'>还没有画像</Text>
          <Text
            className='pill primary'
            style={{ marginTop: '12px' }}
            onClick={() => void Taro.navigateTo({ url: '/packageOnboarding/pages/hub/index' })}
          >
            建立孩子画像
          </Text>
        </View>
      </HiFiMainShell>
    )
  }

  return (
    <HiFiMainShell showInput={false}>
      <Text className='pill' onClick={() => Taro.navigateBack()}>
        ← 返回
      </Text>

      <View className='hero-card compact'>
        <Text className='section-label'>判断依据</Text>
        <Text className='hero-title'>画像从哪来</Text>
        <Text className='hero-copy'>
          下面这些是系统整理画像时主要依据的事——尽量用你能认出来的场景来说。
        </Text>
      </View>

      <View className='section'>
        {items.length > 0 ? (
          items.map((e, i) => (
            <View key={`${e.sourceLabel}-${i}`} className='hifi-card profile-block'>
              <Text className='section-label'>{humanizeMechanismLabel(e.sourceLabel)}</Text>
              <Text className='soft-card-body'>{humanizeEntryRef(e.evidenceText)}</Text>
              {e.explanation ? (
                <Text className='hint-text'>{humanizeEntryRef(e.explanation)}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <View className='hifi-card profile-block'>
            <Text className='section-label'>暂无证据记录</Text>
            <Text className='hint-text'>多聊几次具体晚上或作业场景后，这里会出现依据。</Text>
          </View>
        )}
      </View>
    </HiFiMainShell>
  )
}

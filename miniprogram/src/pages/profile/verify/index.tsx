import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import {
  fetchChipPanelsFromHub,
  readCachedChipPanels,
  type ChipObservationPoint,
} from '@/lib/profileChipPanels'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { getLatestProfile, hasProfile } from '@/services/profileStorage'
import { goToRehearsalTab } from '@/utils/navigation'
import './index.scss'

export default function ProfileVerifyPage() {
  usePublicPageShare({
    title: '育见 · 待验证观察点',
    path: SHARE_PATHS.profileVerify,
  })
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState<ChipObservationPoint[]>(() => {
    const cached = readCachedChipPanels()?.observationPoints
    if (cached?.length) return cached
    return getLatestProfile()?.verificationPoints || []
  })

  useDidShow(() => {
    void (async () => {
      const cached = readCachedChipPanels()?.observationPoints
      if (cached?.length) setPoints(cached)

      const { panels } = await fetchChipPanelsFromHub()
      if (panels?.observationPoints?.length) {
        setPoints(panels.observationPoints)
      } else if (!points.length) {
        setPoints(getLatestProfile()?.verificationPoints || [])
      }
      setLoading(false)
    })()
  })

  if (loading && !points.length) {
    return (
      <HiFiMainShell showInput={false}>
        <View className='loading-wrap'>
          <View className='loader' />
          <Text className='muted'>正在整理观察点…</Text>
        </View>
      </HiFiMainShell>
    )
  }

  if (!hasProfile() && !points.length) {
    return (
      <HiFiMainShell showInput={false}>
        <Text className='pill' onClick={() => Taro.navigateBack()}>
          ← 返回
        </Text>
        <View className='hifi-card profile-block'>
          <Text className='section-label'>还没有画像</Text>
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
        <Text className='section-label'>待验证</Text>
        <Text className='hero-title'>后面再观察什么</Text>
        <Text className='hero-copy'>画像已经够用了，但下面几件事再看清一点，会让后面的判断更准。</Text>
      </View>

      <View className='section'>
        {points.length > 0 ? (
          points.map((v, i) => (
            <View key={`${v.title}-${i}`} className='hifi-card profile-block authority-insight-card'>
              <Text className='authority-badge'>育见解读</Text>
              <Text className='section-label'>{v.title}</Text>
              <Text className='soft-card-body'>{v.description}</Text>
            </View>
          ))
        ) : (
          <View className='hifi-card profile-block'>
            <Text className='section-label'>暂无待验证点</Text>
            <Text className='hint-text'>继续交流和预演，系统会逐步补充需要观察的方向。</Text>
          </View>
        )}
      </View>

      <Text className='hint-text boundary-note'>这些不是要你立刻改变做法，只是后面多留意。</Text>

      <Text className='pill primary' onClick={goToRehearsalTab}>
        进入沟通预演 →
      </Text>
    </HiFiMainShell>
  )
}

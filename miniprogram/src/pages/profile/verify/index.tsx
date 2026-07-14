import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { portraitCardSections, type DailyPortraitCards } from '@/lib/portraitCard'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { apiRequest } from '@/services/api'
import { getLatestProfile, hasProfile } from '@/services/profileStorage'
import { goToRehearsalTab } from '@/utils/navigation'
import './index.scss'

type ObservationPoint = {
  title: string
  description: string
}

/** 从 portraitCards.hypotheses.sections 展开成观察点；每条 item 一条。 */
function pointsFromCards(cards: DailyPortraitCards | undefined): ObservationPoint[] {
  const sections = portraitCardSections(cards?.hypotheses)
  const out: ObservationPoint[] = []
  for (const s of sections) {
    for (const item of s.items) {
      out.push({ title: s.heading, description: item })
    }
  }
  return out
}

export default function ProfileVerifyPage() {
  usePublicPageShare({
    title: '育见 · 待验证观察点',
    path: SHARE_PATHS.profileVerify,
  })
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState<ObservationPoint[]>(() => {
    const local = getLatestProfile()?.verificationPoints || []
    return local.map((v) => ({ title: v.title, description: v.description || '' }))
  })

  useDidShow(() => {
    void (async () => {
      const hub = await apiRequest<{ portraitCards?: DailyPortraitCards }>(
        '/api/profile/hub',
        { method: 'GET' }
      )
      if (hub.ok) {
        const fromCards = pointsFromCards(hub.data.portraitCards)
        if (fromCards.length) {
          setPoints(fromCards)
        } else if (!points.length) {
          const local = getLatestProfile()?.verificationPoints || []
          setPoints(local.map((v) => ({ title: v.title, description: v.description || '' })))
        }
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

import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { apiRequest } from '@/services/api'
import { SHARE_PATHS } from '@/lib/shareMessages'
import {
  getLatestProfile,
  hasProfile,
  hydrateProfileFromRemote,
  type LocalProfileSnapshot,
  type LocalVerificationPoint,
} from '@/services/profileStorage'
import { goToRehearsalTab } from '@/utils/navigation'
import './index.scss'

export default function ProfileVerifyPage() {
  usePublicPageShare({
    title: '育见 · 待验证观察点',
    path: SHARE_PATHS.profileVerify,
  })
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<LocalProfileSnapshot | null>(getLatestProfile())

  useDidShow(() => {
    void (async () => {
      const local = getLatestProfile()
      if (local) setProfile(local)

      const built = await apiRequest<{ snapshot?: LocalProfileSnapshot }>('/api/profile/built', {
        method: 'GET',
      })
      if (built.ok && built.data.snapshot?.coreJudgment) {
        hydrateProfileFromRemote(built.data.snapshot)
        setProfile(getLatestProfile())
      }
      setLoading(false)
    })()
  })

  if (loading && !profile) {
    return (
      <HiFiMainShell showInput={false}>
        <View className='loading-wrap'>
          <View className='loader' />
          <Text className='muted'>正在加载…</Text>
        </View>
      </HiFiMainShell>
    )
  }

  if (!hasProfile() || !profile) {
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

  const points: LocalVerificationPoint[] = profile.verificationPoints || []

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
            <View key={v.id || `${v.title}-${i}`} className='hifi-card profile-block authority-insight-card'>
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

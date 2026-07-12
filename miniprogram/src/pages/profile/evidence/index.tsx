import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { humanizeEntryRef, humanizeMechanismLabel } from '@/lib/entry-name-i18n'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { apiRequest } from '@/services/api'
import {
  getLatestProfile,
  hasProfile,
  hydrateProfileFromRemote,
  type LocalEvidenceItem,
  type LocalProfileSnapshot,
} from '@/services/profileStorage'
import './index.scss'

export default function ProfileEvidencePage() {
  usePublicPageShare({
    title: '育见 · 画像从哪来',
    path: SHARE_PATHS.profileEvidence,
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

  const items: LocalEvidenceItem[] = profile.evidence || []

  return (
    <HiFiMainShell showInput={false}>
      <Text className='pill' onClick={() => Taro.navigateBack()}>
        ← 返回
      </Text>

      <View className='hero-card compact'>
        <Text className='section-label'>判断依据</Text>
        <Text className='hero-title'>画像从哪来</Text>
        <Text className='hero-copy'>
          下面这些信息是系统生成画像时的判断依据。每条证据都标注了来源模块和与机制链的关联。
        </Text>
      </View>

      <View className='section'>
        {items.length > 0 ? (
          items.map((e, i) => (
            <View key={e.id || `${e.sourceLabel}-${i}`} className='hifi-card profile-block'>
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
            <Text className='hint-text'>当前没有足够证据记录，请先完成模块建模。</Text>
          </View>
        )}
      </View>

      <Text
        className='pill primary'
        onClick={() => void Taro.navigateTo({ url: '/pages/profile/verify/index' })}
      >
        看待验证观察点 →
      </Text>
    </HiFiMainShell>
  )
}

import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { humanizeEntryRef } from '@/lib/entry-name-i18n'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { getLatestProfile, hasProfile } from '@/services/profileStorage'
import './index.scss'

export default function ProfileDeepPage() {
  usePublicPageShare({
    title: '育见 · 家庭机制链',
    path: SHARE_PATHS.profileDeep,
  })
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(getLatestProfile())

  useEffect(() => {
    setProfile(getLatestProfile())
    setLoading(false)
  }, [])

  const mechanismText = humanizeEntryRef(profile?.deepMechanism || '')

  if (loading && !profile) {
    return (
      <HiFiMainShell showInput={false}>
        <View className='loading-wrap'>
          <View className='loader' />
        </View>
      </HiFiMainShell>
    )
  }

  if (!hasProfile()) {
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
        <Text className='section-label'>深层解释</Text>
        <Text className='hero-title'>家庭机制链</Text>
        <Text className='hero-copy'>
          下面展示的不是普通总结，而是孩子在这个家庭里的应对链条——家长的动作触发孩子的保护策略，孩子的反应又触发家长进一步解读。
        </Text>
      </View>

      <View className='hifi-card profile-block'>
        {mechanismText ? (
          <>
            <Text className='section-label'>机制链</Text>
            <Text className='deep-mechanism-body'>{mechanismText}</Text>
          </>
        ) : (
          <>
            <Text className='section-label'>信息还不够</Text>
            <Text className='hint-text'>当前信息不足以构建完整机制链，建议补充更多模块信息。</Text>
          </>
        )}
      </View>

      <Text
        className='pill'
        onClick={() => void Taro.navigateTo({ url: '/pages/profile/evidence/index' })}
      >
        判断依据
      </Text>
      <Text
        className='pill'
        onClick={() => void Taro.navigateTo({ url: '/pages/profile/verify/index' })}
      >
        待验证观察点
      </Text>
      <Text
        className='pill primary'
        onClick={() => void Taro.navigateTo({ url: '/packageOnboarding/pages/result/index' })}
      >
        查看完整画像
      </Text>
    </HiFiMainShell>
  )
}

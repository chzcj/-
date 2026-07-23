import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { humanizeEntryRef } from '@/lib/entry-name-i18n'
import { portraitCardLead, type DailyPortraitCards } from '@/lib/portraitCard'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { apiRequest } from '@/services/api'
import { getLatestProfile, hasProfile } from '@/services/profileStorage'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { getChildDisplayName } from '@/services/childStorage'
import './index.scss'

export default function ProfileDeepPage() {
  const childCopy = childSystemCopy(getChildDisplayName())
  usePublicPageShare({
    title: '育见 · 家庭机制链',
    path: SHARE_PATHS.profileDeep,
  })
  const [loading, setLoading] = useState(true)
  const [mechanismText, setMechanismText] = useState(
    () => getLatestProfile()?.deepMechanism || ''
  )

  useDidShow(() => {
    void (async () => {
      const localDeep = getLatestProfile()?.deepMechanism || ''
      if (localDeep) setMechanismText(localDeep)

      const hub = await apiRequest<{ portraitCards?: DailyPortraitCards }>(
        '/api/profile/hub',
        { method: 'GET' }
      )
      if (hub.ok) {
        const lead = portraitCardLead(hub.data.portraitCards?.growth)
        if (lead) setMechanismText(lead)
        else if (!localDeep) setMechanismText(getLatestProfile()?.deepMechanism || '')
      }
      setLoading(false)
    })()
  })

  if (loading && !mechanismText) {
    return (
      <HiFiMainShell showInput={false}>
        <View className='loading-wrap'>
          <View className='loader' />
          <Text className='muted'>正在整理机制链…</Text>
        </View>
      </HiFiMainShell>
    )
  }

  if (!hasProfile() && !mechanismText.trim()) {
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
            {childCopy.buildPortrait}
          </Text>
        </View>
      </HiFiMainShell>
    )
  }

  const display = humanizeEntryRef(mechanismText || '')

  return (
    <HiFiMainShell showInput={false}>
      <Text className='pill' onClick={() => Taro.navigateBack()}>
        ← 返回
      </Text>

      <View className='hero-card compact'>
        <Text className='section-label'>深层解释</Text>
        <Text className='hero-title'>家庭机制链</Text>
        <Text className='hero-copy'>
          {childCopy.deepMechanismLede}
        </Text>
      </View>

      <View className='hifi-card profile-block'>
        {display ? (
          <>
            <Text className='section-label'>机制链</Text>
            <Text className='deep-mechanism-body'>{display}</Text>
          </>
        ) : (
          <>
            <Text className='section-label'>信息还不够</Text>
            <Text className='hint-text'>当前信息不足以构建完整机制链，建议多聊几次具体场景。</Text>
          </>
        )}
      </View>

      <Text
        className='pill primary'
        onClick={() => void Taro.navigateTo({ url: '/packageOnboarding/pages/hub/index' })}
      >
        补充画像
      </Text>
    </HiFiMainShell>
  )
}

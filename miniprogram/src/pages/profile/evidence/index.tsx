import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { humanizeEntryRef, humanizeMechanismLabel } from '@/lib/entry-name-i18n'
import { portraitCardSections, type DailyPortraitCards } from '@/lib/portraitCard'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { apiRequest } from '@/services/api'
import { getLatestProfile, hasProfile } from '@/services/profileStorage'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { getChildDisplayName } from '@/services/childStorage'
import './index.scss'

type EvidenceItem = {
  sourceLabel: string
  evidenceText: string
  explanation?: string
}

/** 从 portraitCards.behavior.sections 展开成证据条目；每条 item 一条。 */
function evidenceFromCards(cards: DailyPortraitCards | undefined): EvidenceItem[] {
  const sections = portraitCardSections(cards?.behavior)
  const out: EvidenceItem[] = []
  for (const s of sections) {
    for (const item of s.items) {
      out.push({ sourceLabel: s.heading, evidenceText: item })
    }
  }
  return out
}

export default function ProfileEvidencePage() {
  const childCopy = childSystemCopy(getChildDisplayName())
  usePublicPageShare({
    title: '育见 · 画像从哪来',
    path: SHARE_PATHS.profileEvidence,
  })
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<EvidenceItem[]>(() => {
    const local = getLatestProfile()?.evidence || []
    return local.map((e) => ({
      sourceLabel: e.sourceLabel || '依据',
      evidenceText: e.evidenceText,
      explanation: e.explanation,
    }))
  })

  useDidShow(() => {
    void (async () => {
      const hub = await apiRequest<{ portraitCards?: DailyPortraitCards }>(
        '/api/profile/hub',
        { method: 'GET' }
      )
      if (hub.ok) {
        const fromCards = evidenceFromCards(hub.data.portraitCards)
        if (fromCards.length) {
          setItems(fromCards)
        } else if (!items.length) {
          const local = getLatestProfile()?.evidence || []
          setItems(
            local.map((e) => ({
              sourceLabel: e.sourceLabel || '依据',
              evidenceText: e.evidenceText,
              explanation: e.explanation,
            }))
          )
        }
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
            {childCopy.buildPortrait}
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

import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { loadChildBasicInfo, getChildDisplayName } from '@/services/childStorage'
import {
  buildHubProfileCards,
  type DailyPortraitCards,
  type StructuralTension,
} from '@/lib/portraitCard'
import { apiRequest } from '@/services/api'
import { getLatestProfile, hasProfile } from '@/services/profileStorage'
import '../memories/index.scss'
import '@/styles/profile-handbook-sheet.scss'

const TILE_BADGE: Record<string, string> = {
  growth: '成长画像',
  focus: '长期关注',
  behavior: '行为模式',
  interaction: '亲子互动',
  strategies: '好方法',
  tensions: '成长阻力',
  hypotheses: '作业机制',
}

type HubPayload = {
  portraitCards?: DailyPortraitCards
  structuralTensions?: StructuralTension[]
  interactionPattern?: string
  effectiveStrategies?: string
  pendingHypotheses?: string
  behaviorSummary?: string
  hasRealData?: boolean
  coreJudgment?: string
  completeness?: number
  supportFocus?: string
  currentFocus?: string
}

export default function ProfileInsightPage() {
  useSafeShareAppMessage({ title: '育见 · 画像洞察' })
  const [loading, setLoading] = useState(true)
  const [childName, setChildName] = useState('')

  const [portraitCards, setPortraitCards] = useState<DailyPortraitCards>({})
  const [hubMeta, setHubMeta] = useState<HubPayload>({})
  const [structuralTensions, setStructuralTensions] = useState<StructuralTension[]>([])
  const [completeness, setCompleteness] = useState(0)
  const [coreJudgment, setCoreJudgment] = useState('')
  const [supportFocus, setSupportFocus] = useState('')
  const [currentFocus, setCurrentFocus] = useState('')

  const childCopy = childSystemCopy(getChildDisplayName())

  useEffect(() => {
    setChildName(loadChildBasicInfo().childName || getChildDisplayName())
    void (async () => {
      setLoading(true)
      try {
        const local = getLatestProfile()
        if (local) {
          setCoreJudgment(local.coreJudgment)
          setSupportFocus(local.supportFocus || '')
        }
        const res = await apiRequest<HubPayload>('/api/profile/hub', { method: 'GET' })
        if (res.ok) {
          const data = res.data
          setPortraitCards(data.portraitCards || {})
          setStructuralTensions(data.structuralTensions || [])
          setHubMeta(data)
          if (data.coreJudgment) setCoreJudgment(data.coreJudgment)
          if (typeof data.completeness === 'number') {
            setCompleteness(data.completeness)
          } else if (local) {
            setCompleteness(local.completeness)
          }
          if (data.supportFocus) setSupportFocus(data.supportFocus)
          if (data.currentFocus) setCurrentFocus(data.currentFocus)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const cards = useMemo(
    () =>
      buildHubProfileCards({
        portraitCards,
        hubCards: hubMeta,
        structuralTensions,
        hasLocalProfile: Boolean(coreJudgment) || hasProfile(),
        completeness,
        coreJudgment,
        supportFocus,
        currentFocus,
      }),
    [portraitCards, hubMeta, structuralTensions, completeness, coreJudgment, supportFocus, currentFocus]
  )

  const openCard = (slug: string) => {
    void Taro.navigateTo({ url: `/pages/profile/card/index?id=${encodeURIComponent(slug)}` })
  }

  return (
    <View className='profile-subpage insight-page'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title='画像洞察'
        showClose
        onBack={() => void Taro.navigateBack()}
        onClose={() => void Taro.switchTab({ url: '/pages/profile/index' })}
      />
      <ScrollView scrollY className='profile-sub-scroll'>
        {loading ? (
          <View className='sub-state'>
            <View className='loader' />
            <Text className='muted'>正在整理画像…</Text>
          </View>
        ) : cards.length ? (
          <>
            <View className='insight-hero'>
              <Text className='sheet-kicker'>育见 · 理解层</Text>
              <Text className='insight-hero-title'>
                {childName}的成长画像
              </Text>
              <Text className='insight-hero-copy'>
                {childCopy.insightLede(cards.length)}
              </Text>
              <View className='insight-pct-row'>
                <Text className='insight-pct-num'>{completeness}%</Text>
                <View className='insight-pct-meta'>
                  <Text className='insight-pct-label'>整体了解进度</Text>
                  <View className='progress-bar'>
                    <View className='progress-bar-fill' style={{ width: `${completeness}%` }} />
                  </View>
                </View>
              </View>
            </View>

            {cards.map((card, index) => {
              const variant = `t${(index % 4) + 1}`
              return (
                <View
                  key={card.slug}
                  className={`insight-card ${variant}`}
                  onClick={() => openCard(card.slug)}
                >
                  <View className='insight-card-top'>
                    <Text className='insight-card-badge'>
                      {TILE_BADGE[card.slug] || card.title}
                    </Text>
                    <Text className='insight-card-title'>{card.title}</Text>
                  </View>
                  <View className='insight-card-glass'>
                    <Text className='insight-card-body'>{card.body}</Text>
                    <View className='insight-card-foot'>
                      <View className='progress-bar'>
                        <View className='progress-bar-fill' style={{ width: `${card.progress}%` }} />
                      </View>
                      <Text className='insight-card-pct'>{card.progress}%</Text>
                    </View>
                    <Text className='insight-card-hint'>{card.progressHint}</Text>
                  </View>
                </View>
              )
            })}
          </>
        ) : (
          <View className='sub-state'>
            <Text className='muted'>完成画像建模后，洞察会在这里展开。</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

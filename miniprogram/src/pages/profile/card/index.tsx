import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { usePublicPageShare } from '@/hooks/useSharePage'
import {
  buildHubProfileCards,
  formatRefreshedAt,
  type DailyPortraitCards,
  type PortraitCardSection,
  type StructuralTension,
} from '@/lib/portraitCard'
import { buildProfileCardSharePath } from '@/lib/shareMessages'
import { apiRequest } from '@/services/api'
import { getLatestProfile, hasProfile } from '@/services/profileStorage'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { getChildDisplayName } from '@/services/childStorage'
import '@/styles/profile-handbook-sheet.scss'
import '../memories/index.scss'
import './index.scss'

const CARD_BADGE: Record<string, string> = {
  growth: '成长画像',
  focus: '长期关注',
  behavior: '行为模式',
  interaction: '亲子互动',
  strategies: '好方法',
  tensions: '成长阻力',
  hypotheses: '作业机制',
}

type ApiSection = PortraitCardSection | { id?: string; title?: string; body?: string }

function normalizeSections(raw?: ApiSection[]): PortraitCardSection[] {
  if (!raw?.length) return []
  return raw
    .map((s) => {
      if ('heading' in s && Array.isArray(s.items)) {
        return { heading: s.heading, items: s.items }
      }
      const legacy = s as { title?: string; body?: string }
      if (!legacy.title && !legacy.body) return null
      return { heading: legacy.title || '详情', items: legacy.body ? [legacy.body] : [] }
    })
    .filter((s): s is PortraitCardSection => Boolean(s?.heading && s.items.length))
}

function cardTitles(copy: ReturnType<typeof childSystemCopy>): Record<string, string> {
  return {
    growth: '动态成长画像',
    focus: '值得长期关注',
    behavior: copy.behaviorPattern,
    interaction: '亲子互动关系',
    strategies: '试试这些好方法',
    hypotheses: copy.homeworkMechanism,
    tensions: copy.growthTension,
  }
}

export default function ProfileCardPage() {
  const router = useRouter()
  const cardId = router.params.id || ''
  const childCopy = childSystemCopy(getChildDisplayName())
  const titles = cardTitles(childCopy)
  usePublicPageShare(() => ({
    title: titles[cardId] ? `育见 · ${titles[cardId]}` : childCopy.portraitShareTitle,
    path: buildProfileCardSharePath(cardId),
  }))

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [lead, setLead] = useState('')
  const [sections, setSections] = useState<PortraitCardSection[]>([])
  const [facts, setFacts] = useState<string[]>([])
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [completeness, setCompleteness] = useState(0)
  const [portraitCards, setPortraitCards] = useState<DailyPortraitCards>({})
  const [hubMeta, setHubMeta] = useState<Record<string, unknown>>({})
  const [structuralTensions, setStructuralTensions] = useState<StructuralTension[]>([])
  const [coreJudgment, setCoreJudgment] = useState('')
  const [supportFocus, setSupportFocus] = useState('')
  const [currentFocus, setCurrentFocus] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!cardId) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError('')
      const local = getLatestProfile()
      if (local) {
        setCoreJudgment(local.coreJudgment)
        setSupportFocus(local.supportFocus || '')
      }

      const [cardRes, hubRes] = await Promise.all([
        apiRequest<{
          title?: string
          summary?: string
          lead?: string
          sections?: ApiSection[]
          anchoredFacts?: string[]
          refreshedAt?: string | null
        }>(`/api/profile/card/${encodeURIComponent(cardId)}`, { method: 'GET' }),
        apiRequest<{
          portraitCards?: DailyPortraitCards
          structuralTensions?: StructuralTension[]
          completeness?: number
          coreJudgment?: string
          supportFocus?: string
          currentFocus?: string
        }>('/api/profile/hub', { method: 'GET' }),
      ])

      if (cancelled) return

      if (hubRes.ok) {
        const data = hubRes.data
        setPortraitCards(data.portraitCards || {})
        setStructuralTensions(data.structuralTensions || [])
        setHubMeta(data)
        if (typeof data.completeness === 'number') setCompleteness(data.completeness)
        else if (local) setCompleteness(local.completeness)
        if (data.coreJudgment) setCoreJudgment(data.coreJudgment)
        if (data.supportFocus) setSupportFocus(data.supportFocus)
        if (data.currentFocus) setCurrentFocus(data.currentFocus)
      }

      if (cardRes.ok) {
        const normalized = normalizeSections(cardRes.data.sections)
        setTitle(cardRes.data.title || titles[cardId] || cardId)
        setSummary(cardRes.data.summary || '')
        setLead(cardRes.data.lead || '')
        setSections(normalized)
        setFacts(cardRes.data.anchoredFacts || [])
        setRefreshedAt(cardRes.data.refreshedAt || null)
        const initialOpen: Record<string, boolean> = {}
        normalized.forEach((s, i) => {
          initialOpen[s.heading] = i === 0
        })
        if (cardRes.data.anchoredFacts?.length) initialOpen.__facts = true
        setOpenSections(initialOpen)
      } else {
        setLoadError(cardRes.error.message || '加载失败')
        setTitle(titles[cardId] || cardId)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [cardId])

  const cardMeta = useMemo(() => {
    const cards = buildHubProfileCards({
      portraitCards,
      hubCards: hubMeta as never,
      structuralTensions,
      hasLocalProfile: Boolean(coreJudgment) || hasProfile(),
      completeness,
      coreJudgment,
      supportFocus,
      currentFocus,
    })
    return cards.find((c) => c.slug === cardId)
  }, [portraitCards, hubMeta, structuralTensions, completeness, coreJudgment, supportFocus, currentFocus, cardId])

  const progress = cardMeta?.progress ?? 8
  const progressHint = cardMeta?.progressHint ?? ''
  const hasContent = summary || lead || sections.length > 0 || facts.length > 0
  const displayLead = lead && lead !== summary ? lead : summary
  const badge = CARD_BADGE[cardId] || '画像卡片'

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const goBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      void Taro.navigateBack()
      return
    }
    void Taro.switchTab({ url: '/pages/profile/index' })
  }

  return (
    <View className='profile-subpage card-detail-page'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title={title || titles[cardId] || '画像详情'}
        showClose
        onBack={goBack}
        onClose={() => void Taro.switchTab({ url: '/pages/profile/index' })}
      />
      <ScrollView scrollY className='profile-sub-scroll card-detail-scroll'>
        {loading ? (
          <View className='sub-state'>
            <View className='loader' />
            <Text className='muted'>正在加载…</Text>
          </View>
        ) : loadError ? (
          <View className='sub-error'>
            <Text className='muted'>{loadError}</Text>
          </View>
        ) : hasContent ? (
          <>
            <View className='detail-hero'>
              <View className='detail-hero-top'>
                <Text className='detail-hero-badge'>{badge}</Text>
                {refreshedAt ? (
                  <Text className='detail-hero-time'>{formatRefreshedAt(refreshedAt)}</Text>
                ) : null}
              </View>
              <Text className='detail-hero-title'>{title}</Text>
              {displayLead ? <Text className='detail-hero-lead'>{displayLead}</Text> : null}
              <View className='detail-progress-card'>
                <View className='detail-progress-head'>
                  <Text className='detail-progress-label'>本卡了解进度</Text>
                  <Text className='detail-progress-pct'>{progress}%</Text>
                </View>
                <View className='progress-bar detail-progress-bar'>
                  <View className='progress-bar-fill' style={{ width: `${progress}%` }} />
                </View>
                {progressHint ? <Text className='detail-progress-hint'>{progressHint}</Text> : null}
              </View>
            </View>

            {sections.map((section, index) => {
              const open = openSections[section.heading] ?? index === 0
              return (
                <View key={section.heading} className={`detail-section-card ${open ? 'is-open' : ''}`}>
                  <View className='detail-section-head' onClick={() => toggleSection(section.heading)}>
                    <View className='detail-section-index'>
                      <Text>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                    <Text className='detail-section-title'>{section.heading}</Text>
                    <Text className='detail-section-chevron'>{open ? '−' : '+'}</Text>
                  </View>
                  {open ? (
                    <View className='detail-section-body'>
                      {section.items.map((item) => (
                        <View key={item.slice(0, 32)} className='detail-bullet-row'>
                          <View className='detail-bullet-dot' />
                          <Text className='detail-bullet-text'>{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              )
            })}

            {facts.length ? (
              <View className={`detail-section-card detail-facts-card ${openSections.__facts ? 'is-open' : ''}`}>
                <View className='detail-section-head' onClick={() => toggleSection('__facts')}>
                  <View className='detail-section-index detail-section-index--facts'>
                    <Text>✦</Text>
                  </View>
                  <Text className='detail-section-title'>依据你家已记录的事实</Text>
                  <Text className='detail-section-chevron'>{openSections.__facts ? '−' : '+'}</Text>
                </View>
                {openSections.__facts ? (
                  <View className='detail-section-body detail-facts-body'>
                    {facts.map((f) => (
                      <View key={f.slice(0, 32)} className='detail-fact-quote'>
                        <Text className='detail-fact-text'>{f}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <View className='sub-state'>
            <Text className='muted'>继续交流后，这里会出现更完整的深度分析。</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { formatRefreshedAt, type PortraitCardSection, type StructuralTension } from '@/lib/portraitCard'
import { buildProfileCardSharePath } from '@/lib/shareMessages'
import { apiRequest } from '@/services/api'
import './index.scss'

const CARD_TITLES: Record<string, string> = {
  growth: '动态成长画像',
  focus: '当前关注点',
  behavior: '行为模式总结',
  interaction: '家庭互动模式',
  strategies: '有效策略',
  hypotheses: '待验证假设',
  tensions: '家庭运转张力',
}

type DetailTab = 'top5' | 'chain' | 'card'

type ApiSection = PortraitCardSection | { id?: string; title?: string; body?: string }

type TopMechanismCard = {
  title: string
  insight: string
  fact: string
  role: 'primary' | 'secondary'
  protect?: string
}

type ChainCell = {
  label: string
  text: string
}

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

function parseTab(raw: string | undefined): DetailTab {
  if (raw === 'chain' || raw === 'card') return raw
  return 'top5'
}

export default function ProfileCardPage() {
  const router = useRouter()
  const cardId = router.params.id || ''
  const initialTab = parseTab(router.params.tab)
  usePublicPageShare(() => ({
    title: CARD_TITLES[cardId] ? `育见 · ${CARD_TITLES[cardId]}` : '育见 · 孩子画像',
    path: buildProfileCardSharePath(cardId),
  }))

  const [tab, setTab] = useState<DetailTab>(initialTab)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [lead, setLead] = useState('')
  const [sections, setSections] = useState<PortraitCardSection[]>([])
  const [facts, setFacts] = useState<string[]>([])
  const [tensions, setTensions] = useState<StructuralTension[]>([])
  const [topMechanisms, setTopMechanisms] = useState<TopMechanismCard[]>([])
  const [chainCells, setChainCells] = useState<ChainCell[]>([])
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    setTab(parseTab(router.params.tab))
  }, [router.params.tab])

  useEffect(() => {
    if (!cardId) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError('')
      const res = await apiRequest<{
        title?: string
        summary?: string
        lead?: string
        sections?: ApiSection[]
        anchoredFacts?: string[]
        structuralTensions?: StructuralTension[]
        topMechanisms?: TopMechanismCard[]
        chainCells?: ChainCell[]
        refreshedAt?: string | null
      }>(`/api/profile/card/${encodeURIComponent(cardId)}`, { method: 'GET' })
      if (cancelled) return
      if (res.ok) {
        setTitle(res.data.title || CARD_TITLES[cardId] || cardId)
        setSummary(res.data.summary || '')
        setLead(res.data.lead || '')
        setSections(normalizeSections(res.data.sections))
        setFacts(res.data.anchoredFacts || [])
        setTensions(res.data.structuralTensions || [])
        setTopMechanisms(Array.isArray(res.data.topMechanisms) ? res.data.topMechanisms : [])
        setChainCells(Array.isArray(res.data.chainCells) ? res.data.chainCells : [])
        setRefreshedAt(res.data.refreshedAt || null)
      } else {
        setLoadError(res.error.message || '加载失败')
        setTitle(CARD_TITLES[cardId] || cardId)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [cardId])

  const hasCardContent =
    summary || lead || sections.length > 0 || tensions.length > 0 || facts.length > 0
  const displayLead = lead && lead !== summary ? lead : ''

  const primary = useMemo(
    () => topMechanisms.find((m) => m.role === 'primary') || topMechanisms[0],
    [topMechanisms]
  )
  const secondaries = useMemo(
    () => topMechanisms.filter((m) => m !== primary),
    [topMechanisms, primary]
  )

  const goBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      void Taro.navigateBack()
      return
    }
    void Taro.switchTab({ url: '/pages/profile/index' })
  }

  const emptyAuthority =
    '四个模块已有材料。继续交流后，会把「这一个孩子」写得更准——不是套用通用说法，而是基于你家已记录的现场。'

  return (
    <HiFiMainShell surface='white'>
      <Text className='pill back-pill' onClick={goBack}>
        ‹ 返回画像
      </Text>

      <View className='profile-section'>
        <Text className='hero-title page-heading'>{title || '画像详情'}</Text>
        {refreshedAt ? (
          <Text className='muted refreshed-line'>上次整理：{formatRefreshedAt(refreshedAt)}</Text>
        ) : null}

        <ScrollView scrollX className='detail-tab-scroll' enhanced showScrollbar={false}>
          <View className='detail-tabs'>
            {(
              [
                { id: 'top5' as const, label: 'Top5' },
                { id: 'chain' as const, label: '机制链' },
                { id: 'card' as const, label: '本卡' },
              ] as const
            ).map((item) => (
              <Text
                key={item.id}
                className={`detail-tab${tab === item.id ? ' active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </Text>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <View className='loading-wrap'>
            <View className='loader' />
            <Text className='muted'>正在加载…</Text>
          </View>
        ) : loadError ? (
          <View className='detail-panel'>
            <Text className='muted'>{loadError}</Text>
          </View>
        ) : tab === 'top5' ? (
          <View className='tab-pane'>
            {topMechanisms.length === 0 ? (
              <View className='detail-panel empty-panel'>
                <Text className='empty-title'>还在把你家写清楚</Text>
                <Text className='empty-copy'>{emptyAuthority}</Text>
              </View>
            ) : (
              <>
                {primary ? (
                  <View className='mech-card primary-card'>
                    <View className='mech-card-head'>
                      <Text className='role-pill primary-pill'>核心</Text>
                      <Text className='mech-title'>{primary.title}</Text>
                    </View>
                    <Text className='mech-insight'>{primary.insight}</Text>
                    {primary.fact ? (
                      <Text className='mech-fact'>依据：{primary.fact}</Text>
                    ) : null}
                    {primary.protect ? (
                      <Text className='mech-protect'>可能在护着：{primary.protect}</Text>
                    ) : null}
                  </View>
                ) : null}
                {secondaries.map((m) => (
                  <View key={`${m.title}-${m.insight.slice(0, 12)}`} className='mech-card secondary-card'>
                    <View className='mech-card-head'>
                      <Text className='role-pill secondary-pill'>观察</Text>
                      <Text className='mech-title'>{m.title}</Text>
                    </View>
                    <Text className='mech-insight'>{m.insight}</Text>
                    {m.fact ? <Text className='mech-fact'>依据：{m.fact}</Text> : null}
                    {m.protect ? (
                      <Text className='mech-protect'>可能在护着：{m.protect}</Text>
                    ) : null}
                  </View>
                ))}
              </>
            )}
          </View>
        ) : tab === 'chain' ? (
          <View className='tab-pane'>
            {chainCells.length === 0 ? (
              <View className='detail-panel empty-panel'>
                <Text className='empty-title'>链条还在成形</Text>
                <Text className='empty-copy'>{emptyAuthority}</Text>
              </View>
            ) : (
              <View className='chain-list'>
                {chainCells.map((cell, idx) => (
                  <View key={`${cell.label}-${idx}`} className='chain-step'>
                    <View className='chain-rail'>
                      <View className='chain-dot' />
                      {idx < chainCells.length - 1 ? <View className='chain-line' /> : null}
                    </View>
                    <View className='chain-body'>
                      <Text className='chain-label'>{cell.label}</Text>
                      <Text className='chain-text'>{cell.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className='tab-pane'>
            {cardId === 'tensions' && tensions.length ? (
              tensions.map((t) => (
                <View key={t.title} className='detail-panel tension-card'>
                  <Text className='section-label'>{t.title}</Text>
                  <Text className='detail-item-plain'>{t.detail}</Text>
                </View>
              ))
            ) : hasCardContent ? (
              <View className='detail-panel portrait-detail-card'>
                {displayLead ? <Text className='lead'>{displayLead}</Text> : null}
                {sections.map((section) => (
                  <View key={section.heading} className='detail-section'>
                    <Text className='section-label'>{section.heading}</Text>
                    {section.items.map((item) => (
                      <Text key={item.slice(0, 32)} className='detail-item'>
                        · {item}
                      </Text>
                    ))}
                  </View>
                ))}
                {facts.length ? (
                  <View className='detail-section'>
                    <Text className='section-label'>依据你家已记录的事实</Text>
                    {facts.map((f) => (
                      <Text key={f.slice(0, 32)} className='detail-item'>
                        · {f}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {!displayLead && !sections.length && summary ? (
                  <Text className='lead'>{summary}</Text>
                ) : null}
              </View>
            ) : (
              <View className='detail-panel empty-panel'>
                <Text className='empty-title'>本卡还在积累</Text>
                <Text className='empty-copy'>{emptyAuthority}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </HiFiMainShell>
  )
}

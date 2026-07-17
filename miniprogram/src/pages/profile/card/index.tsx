import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { formatRefreshedAt, type PortraitCardSection } from '@/lib/portraitCard'
import { buildProfileCardSharePath } from '@/lib/shareMessages'
import { apiRequest } from '@/services/api'
import './index.scss'

const CARD_TITLES: Record<string, string> = {
  growth: '动态成长画像',
  focus: '值得长期关注',
  behavior: '孩子行为模式',
  interaction: '亲子互动关系',
  strategies: '试试这些好方法',
  hypotheses: '孩子写作业的机制',
  tensions: '孩子健康成长阻力',
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

export default function ProfileCardPage() {
  const router = useRouter()
  const cardId = router.params.id || ''
  usePublicPageShare(() => ({
    title: CARD_TITLES[cardId] ? `育见 · ${CARD_TITLES[cardId]}` : '育见 · 孩子画像',
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
        refreshedAt?: string | null
      }>(`/api/profile/card/${encodeURIComponent(cardId)}`, { method: 'GET' })
      if (cancelled) return
      if (res.ok) {
        setTitle(res.data.title || CARD_TITLES[cardId] || cardId)
        setSummary(res.data.summary || '')
        setLead(res.data.lead || '')
        setSections(normalizeSections(res.data.sections))
        setFacts(res.data.anchoredFacts || [])
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

  const hasContent = summary || lead || sections.length > 0 || facts.length > 0
  const displayLead = lead && lead !== summary ? lead : ''

  const goBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      void Taro.navigateBack()
      return
    }
    void Taro.switchTab({ url: '/pages/profile/index' })
  }

  return (
    <HiFiMainShell surface='white'>
      <Text className='pill back-pill' onClick={goBack}>
        ‹ 返回画像
      </Text>

      <View className='profile-section'>
        <Text className='hero-title page-heading'>{title}</Text>
        {refreshedAt ? (
          <Text className='muted'>上次整理：{formatRefreshedAt(refreshedAt)}</Text>
        ) : null}

        {loading ? (
          <View className='loading-wrap'>
            <View className='loader' />
            <Text className='muted'>正在加载…</Text>
          </View>
        ) : loadError ? (
          <View className='hifi-card'>
            <Text className='muted'>{loadError}</Text>
          </View>
        ) : hasContent ? (
          <View className='hifi-card portrait-detail-card'>
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
            {!displayLead && !sections.length && summary ? <Text className='lead'>{summary}</Text> : null}
          </View>
        ) : (
          <View className='hifi-card'>
            <Text className='muted'>继续交流后，这里会出现更完整的深度分析。</Text>
          </View>
        )}
      </View>
    </HiFiMainShell>
  )
}

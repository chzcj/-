import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useMemo, useRef, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { ProfileEditModals, type EditModalKind } from '@/components/profile/ProfileEditModals'
import { useTabBar } from '@/hooks/useTabBar'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { SHARE_PATHS } from '@/lib/shareMessages'
import {
  buildHubProfileCards,
  formatRefreshedAt,
  hasCardContent,
  truncateText,
  type DailyPortraitCards,
  type StructuralTension,
} from '@/lib/portraitCard'
import { readProfileTabCache, writeProfileTabCache } from '@/lib/profileTabCache'
import { writeCachedChipPanels, type ProfileChipPanels } from '@/lib/profileChipPanels'
import { apiRequest } from '@/services/api'
import { logout, fetchCurrentUser } from '@/services/auth'
import { forceAccountSyncToServer } from '@/services/accountSync'
import {
  getLatestProfile,
  hasProfile,
  hydrateProfileFromRemote,
  type LocalProfileSnapshot,
} from '@/services/profileStorage'
import { requireOnboardingComplete } from '@/utils/navigation'
import './index.scss'

type HubPayload = {
  coreJudgment?: string
  completeness?: number
  supportFocus?: string
  currentFocus?: string
  interactionPattern?: string
  effectiveStrategies?: string
  pendingHypotheses?: string
  behaviorSummary?: string
  hasRealData?: boolean
  portraitCards?: DailyPortraitCards
  refreshedAt?: string | null
  pendingHypothesesList?: string[]
  structuralTensions?: StructuralTension[]
  chipPanels?: ProfileChipPanels | null
  panelsReady?: boolean
  highlights?: string[]
}

type SnapshotPayload = {
  currentFocus?: string
  recentChanges?: Array<{ title: string; body?: string }>
}

type WeeklyPayload = {
  weeklySummary?: string
}

export default function ProfilePage() {
  useTabBar('profile')
  usePublicPageShare({
    title: '育见 · 孩子画像',
    path: SHARE_PATHS.profile,
  })
  const [hubLoading, setHubLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hubError, setHubError] = useState('')
  const [profileReady, setProfileReady] = useState(false)
  const [completeness, setCompleteness] = useState(0)
  const [coreJudgment, setCoreJudgment] = useState('')
  const [supportFocus, setSupportFocus] = useState('')
  const [currentFocus, setCurrentFocus] = useState('')
  const [recentTitle, setRecentTitle] = useState('')
  const [weeklySummary, setWeeklySummary] = useState('')
  const [pendingList, setPendingList] = useState<string[]>([])
  const [portraitCards, setPortraitCards] = useState<DailyPortraitCards>({})
  const [hubMeta, setHubMeta] = useState<{
    interactionPattern?: string
    effectiveStrategies?: string
    pendingHypotheses?: string
    behaviorSummary?: string
    hasRealData?: boolean
  }>({})
  const [structuralTensions, setStructuralTensions] = useState<StructuralTension[]>([])
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)
  const [updateNotice, setUpdateNotice] = useState('')
  const [modal, setModal] = useState<EditModalKind>(null)
  const [isWechatUser, setIsWechatUser] = useState(true)

  const syncLocalProfile = useCallback(() => {
    const local = getLatestProfile()
    if (local) {
      setProfileReady(true)
      setCompleteness(local.completeness)
      setCoreJudgment(local.coreJudgment)
      setSupportFocus(local.supportFocus || '')
      return true
    }
    setProfileReady(false)
    setCompleteness(0)
    setCoreJudgment('')
    setSupportFocus('')
    return false
  }, [])

  const applyHubData = useCallback(
    (data: HubPayload | undefined) => {
      if (!data) return
      setHubMeta({
        interactionPattern: data.interactionPattern,
        effectiveStrategies: data.effectiveStrategies,
        pendingHypotheses: data.pendingHypotheses,
        behaviorSummary: data.behaviorSummary,
        hasRealData: data.hasRealData,
      })
      if (data.portraitCards) setPortraitCards(data.portraitCards)
      if (data.refreshedAt !== undefined) setRefreshedAt(data.refreshedAt)
      if (data.pendingHypothesesList) setPendingList(data.pendingHypothesesList)
      if (Array.isArray(data.structuralTensions)) setStructuralTensions(data.structuralTensions)
      if (data.chipPanels) writeCachedChipPanels(data.chipPanels)
      if (Array.isArray(data.highlights)) setHighlights(data.highlights.filter(Boolean))
      if (data.coreJudgment) {
        setCoreJudgment(data.coreJudgment)
        setCompleteness(typeof data.completeness === 'number' ? data.completeness : 0)
        setProfileReady(true)
      }
      if (data.supportFocus) setSupportFocus(data.supportFocus)
      if (data.currentFocus) setCurrentFocus(data.currentFocus)
    },
    []
  )

  const refreshProfile = useCallback(
    async (showLoading = true, forceNetwork = false) => {
      if (refreshing) return
      if (showLoading) setRefreshing(true)
      setHubError('')

      const cached = !forceNetwork ? readProfileTabCache() : null
      if (cached && !showLoading) {
        const built = cached.built as { ok?: boolean; data?: { snapshot?: LocalProfileSnapshot } } | null
        if (built?.ok && built.data?.snapshot?.coreJudgment) {
          hydrateProfileFromRemote(built.data.snapshot)
          syncLocalProfile()
        }
        const snap = cached.snapshot as { ok?: boolean; data?: SnapshotPayload } | null
        if (snap?.ok) {
          if (snap.data?.currentFocus) setCurrentFocus(snap.data.currentFocus)
          if (snap.data?.recentChanges?.[0]?.title) setRecentTitle(snap.data.recentChanges[0].title)
        }
        const wk = cached.weekly as { ok?: boolean; data?: WeeklyPayload } | null
        if (wk?.ok && wk.data?.weeklySummary) setWeeklySummary(wk.data.weeklySummary)
        const hub = cached.hub as { ok?: boolean; data?: HubPayload } | null
        if (hub?.ok) applyHubData(hub.data)
      }

      if (!syncLocalProfile()) {
        const built = await apiRequest<{ snapshot?: LocalProfileSnapshot }>('/api/profile/built', {
          method: 'GET',
        })
        writeProfileTabCache({ built })
        if (built.ok && built.data.snapshot?.coreJudgment) {
          hydrateProfileFromRemote(built.data.snapshot)
          syncLocalProfile()
        }
      }

      const [snapshot, weekly, hub] = await Promise.all([
        apiRequest<SnapshotPayload>('/api/profile/snapshot', { method: 'GET' }),
        apiRequest<WeeklyPayload>('/api/profile/weekly-review', { method: 'GET' }),
        apiRequest<HubPayload>('/api/profile/hub', { method: 'GET' }),
      ])

      writeProfileTabCache({ snapshot, weekly, hub })

      if (hub.ok) {
        applyHubData(hub.data)
      } else {
        setHubError(hub.error.message || '画像暂时加载失败')
      }

      if (snapshot.ok) {
        if (snapshot.data.currentFocus) setCurrentFocus(snapshot.data.currentFocus)
        if (snapshot.data.recentChanges?.[0]?.title) setRecentTitle(snapshot.data.recentChanges[0].title)
      }

      if (weekly.ok && weekly.data.weeklySummary) {
        setWeeklySummary(weekly.data.weeklySummary)
      }

      if (showLoading) setRefreshing(false)
    },
    [applyHubData, refreshing, syncLocalProfile]
  )

  const bootedRef = useRef(false)
  const lastRefreshAtRef = useRef(0)

  const runDisplayRefresh = useCallback(async (prevAt: string | null) => {
    setBackgroundRefreshing(true)
    try {
      await apiRequest('/api/account/daily-refresh', { method: 'POST' })
    } catch {
      /* 后台刷新失败不阻塞 */
    }
    await refreshProfile(false, true)
    setBackgroundRefreshing(false)
    const nextAt =
      (readProfileTabCache()?.hub as { ok?: boolean; data?: { refreshedAt?: string } } | null)?.data
        ?.refreshedAt || null
    if (nextAt && prevAt && nextAt !== prevAt) {
      setUpdateNotice('画像已根据最新交流更新')
      setTimeout(() => setUpdateNotice(''), 4000)
    }
  }, [refreshProfile])

  useDidShow(() => {
    void (async () => {
      const user = await fetchCurrentUser()
      if (!requireOnboardingComplete(user)) return
      setIsWechatUser(Boolean(user?.phone?.startsWith('wx_')))

      syncLocalProfile()

      const cached = readProfileTabCache()
      if (cached) {
        const built = cached.built as { ok?: boolean; data?: { snapshot?: LocalProfileSnapshot } } | null
        if (built?.ok && built.data?.snapshot?.coreJudgment) {
          hydrateProfileFromRemote(built.data.snapshot)
          syncLocalProfile()
        }
        const snap = cached.snapshot as { ok?: boolean; data?: SnapshotPayload } | null
        if (snap?.ok) {
          if (snap.data?.currentFocus) setCurrentFocus(snap.data.currentFocus)
          if (snap.data?.recentChanges?.[0]?.title) setRecentTitle(snap.data.recentChanges[0].title)
        }
        const wk = cached.weekly as { ok?: boolean; data?: WeeklyPayload } | null
        if (wk?.ok && wk.data?.weeklySummary) setWeeklySummary(wk.data.weeklySummary)
        const hub = cached.hub as { ok?: boolean; data?: HubPayload } | null
        if (hub?.ok) applyHubData(hub.data)
        setHubLoading(false)
      } else if (!bootedRef.current) {
        setHubLoading(true)
        await refreshProfile(true)
        setHubLoading(false)
      } else {
        await refreshProfile(false)
      }

      bootedRef.current = true

      const now = Date.now()
      // 极短防抖：连点/快速切 Tab 不双刷；语义仍是每次进 Tab 整理
      if (now - lastRefreshAtRef.current < 1500) return
      lastRefreshAtRef.current = now

      const prevAt =
        (readProfileTabCache()?.hub as { ok?: boolean; data?: { refreshedAt?: string } } | null)?.data
          ?.refreshedAt || refreshedAt
      await runDisplayRefresh(prevAt)
    })()
  })

  const hasLocalProfile = profileReady || hasProfile()
  const profileCards = useMemo(
    () =>
      buildHubProfileCards({
        portraitCards,
        hubCards: hubMeta,
        structuralTensions,
        hasLocalProfile,
        completeness,
        coreJudgment,
        supportFocus,
        currentFocus,
      }),
    [
      portraitCards,
      hubMeta,
      structuralTensions,
      hasLocalProfile,
      completeness,
      coreJudgment,
      supportFocus,
      currentFocus,
    ]
  )
  const highlightItems = highlights.length
    ? highlights
    : [recentTitle, weeklySummary ? truncateText(weeklySummary, 48) : ''].filter(Boolean)

  const openCard = (slug: string) => {
    Taro.navigateTo({ url: `/pages/profile/card/index?id=${encodeURIComponent(slug)}` })
  }

  return (
    <HiFiMainShell surface='white'>
      <View className='profile-section'>
        <View className='section-heading-row'>
          <Text className='hero-title page-heading'>画像数据中心</Text>
          {refreshedAt ? (
            <Text className='profile-refreshed-at'>上次整理：{formatRefreshedAt(refreshedAt)}</Text>
          ) : null}
        </View>
        {backgroundRefreshing ? <Text className='muted'>后台整理中…</Text> : null}
        {updateNotice ? <Text className='update-notice'>{updateNotice}</Text> : null}

        {hubLoading ? (
          <View className='loading-wrap'>
            <View className='loader' />
            <Text className='muted'>正在整理今日画像…</Text>
          </View>
        ) : profileCards.length ? (
          profileCards.map((card) => (
            <View key={card.slug} className='hifi-card profile-data-card' onClick={() => openCard(card.slug)}>
              <Text className='profile-card-title'>
                {card.title}
                {card.slug === 'growth' && hasLocalProfile ? ` · ${completeness}%` : ''}
                <Text className='card-chevron'> ▸</Text>
              </Text>
              <Text className='profile-card-summary muted'>{card.body}</Text>
              <View className='completeness-bar small'>
                <View className='completeness-fill' style={{ width: `${card.progress}%` }} />
              </View>
              <Text className='progress-hint muted'>{card.progressHint}</Text>
            </View>
          ))
        ) : (
          <View className='hifi-card'>
            <Text className='muted'>
              {hubError || '完成画像建模后，这里会展示孩子的 SecondMe 摘要卡。'}
            </Text>
          </View>
        )}

        {!hasLocalProfile ? (
          <Text className='pill refresh-pill' onClick={() => void refreshProfile(true)}>
            {refreshing ? '正在刷新…' : '刷新画像'}
          </Text>
        ) : null}
      </View>

      <View className='profile-section'>
        <Text className='section-label'>孩子近期的闪光点</Text>
        <View className='hifi-card profile-block'>
          {highlightItems.length ? (
            highlightItems.map((item) => (
              <Text key={item} className='trend-item'>
                · {item}
              </Text>
            ))
          ) : (
            <Text className='muted'>继续交流后，这里会出现孩子的进步与优势。</Text>
          )}
        </View>
      </View>

      {pendingList.length > 0 &&
      !hasCardContent(portraitCards.hypotheses, hubMeta.pendingHypotheses || '') ? (
        <View className='profile-section'>
          <Text className='section-label'>待确认观点</Text>
          <View className='hifi-card profile-block'>
            {pendingList.map((item) => (
              <Text key={item} className='link-text' onClick={() => openCard('hypotheses')}>
                · {item}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View className='profile-section'>
        <Text className='section-label'>画像维护</Text>
        <View className='hifi-card setting-group'>
          <Text
            className='setting-row'
            onClick={() => void Taro.navigateTo({ url: '/packageOnboarding/pages/hub/index' })}
          >
            补充画像 ›
          </Text>
        </View>
      </View>

      <View className='profile-section'>
        <Text className='section-label'>账号管理</Text>
        <View className='hifi-card setting-group'>
          <Text className='setting-row' onClick={() => setModal('profile')}>
            编辑个人资料 ›
          </Text>
          <Text className='setting-row' onClick={() => setModal('child')}>
            编辑孩子信息 ›
          </Text>
          {!isWechatUser ? (
            <Text className='setting-row' onClick={() => setModal('password')}>
              修改密码 ›
            </Text>
          ) : null}
          <Text className='setting-row danger' onClick={() => setModal('delete')}>
            注销账号 ›
          </Text>
          <Text
            className='setting-row logout-row'
            onClick={() => {
              Taro.showModal({
                title: '退出登录',
                content: '确定退出登录？',
                success: (res) => {
                  if (res.confirm) {
                    void forceAccountSyncToServer()
                      .catch(() => undefined)
                      .then(() => logout())
                      .then(() => {
                        void Taro.reLaunch({ url: '/pages/login/index' })
                      })
                  }
                },
              })
            }}
          >
            退出登录 ›
          </Text>
        </View>
      </View>

      <ProfileEditModals kind={modal} onClose={() => setModal(null)} />
    </HiFiMainShell>
  )
}

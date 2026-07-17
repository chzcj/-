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
  type DailyPortraitCards,
  type StructuralTension,
} from '@/lib/portraitCard'
import { readProfileTabCache, writeProfileTabCache } from '@/lib/profileTabCache'
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
  highlights?: string[]
}

type TrajectoryPayload = {
  trajectory?: {
    summary: string
    entries: Array<{ title: string; occurredAt: string }>
    updatedAt: string
  } | null
  refreshing?: boolean
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
  const [trajectory, setTrajectory] = useState<TrajectoryPayload['trajectory']>(null)
  const [trajectoryRefreshing, setTrajectoryRefreshing] = useState(false)
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
        const snap = cached.snapshot as { ok?: boolean; data?: { currentFocus?: string } } | null
        if (snap?.ok && snap.data?.currentFocus) setCurrentFocus(snap.data.currentFocus)
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

      const [snapshot, hub, trajectoryRes] = await Promise.all([
        apiRequest<{ currentFocus?: string }>('/api/profile/snapshot', { method: 'GET' }),
        apiRequest<HubPayload>('/api/profile/hub', { method: 'GET' }),
        apiRequest<TrajectoryPayload>('/api/profile/trajectory', { method: 'GET' }),
      ])

      writeProfileTabCache({ snapshot, hub })

      if (hub.ok) {
        applyHubData(hub.data)
      } else {
        setHubError(hub.error.message || '画像暂时加载失败')
      }

      if (snapshot.ok && snapshot.data.currentFocus) setCurrentFocus(snapshot.data.currentFocus)
      if (trajectoryRes.ok) {
        setTrajectory(trajectoryRes.data.trajectory || null)
        setTrajectoryRefreshing(Boolean(trajectoryRes.data.refreshing))
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
        const snap = cached.snapshot as { ok?: boolean; data?: { currentFocus?: string } } | null
        if (snap?.ok && snap.data?.currentFocus) setCurrentFocus(snap.data.currentFocus)
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
              {card.slug === 'tensions' ? (
                <Text className='profile-card-subtitle'>
                  发现家庭中可能影响孩子成长的习惯与互动模式
                </Text>
              ) : null}
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

      <View
        className='profile-section trajectory-summary-card'
        onClick={() => void Taro.navigateTo({ url: '/pages/profile/trajectory/index' })}
      >
        <Text className='section-label'>成长轨迹</Text>
        <View className='hifi-card profile-block'>
          <Text className='trajectory-summary-title'>
            {trajectory?.entries?.[0]?.title || '正在整理家庭成长手账'}
            <Text className='card-chevron'> ▸</Text>
          </Text>
          <Text className='profile-card-summary muted'>
            {trajectory?.summary || '交流、任务反馈、预演和亲子对话中的关键变化，会在这里慢慢沉淀。'}
          </Text>
          <Text className='progress-hint muted'>
            {trajectoryRefreshing
              ? '正在整理新的成长记录…'
              : trajectory
                ? `已沉淀 ${trajectory.entries.length} 个成长节点`
                : '继续记录后会自动更新'}
          </Text>
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

import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useMemo, useRef, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { PortraitMemoryHero } from '@/components/profile/PortraitMemoryHero'
import { PortraitTileStrip } from '@/components/profile/PortraitTileStrip'
import { WeeklyHandbookCard } from '@/components/profile/WeeklyHandbookCard'
import { ProfileEditModals, type EditModalKind } from '@/components/profile/ProfileEditModals'
import { useTabBar } from '@/hooks/useTabBar'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { SHARE_PATHS } from '@/lib/shareMessages'
import type { HandbookPack } from '@/lib/handbookPack'
import {
  buildHubProfileCards,
  formatRefreshedAt,
  type DailyPortraitCards,
  type StructuralTension,
} from '@/lib/portraitCard'
import { readProfileTabCache, writeLastHandbookPack, writeProfileTabCache } from '@/lib/profileTabCache'
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
  presentationWatermark?: {
    compositeVersion?: string
    partiallyRefreshing?: boolean
    uiStale?: boolean
    digestStale?: boolean
    buildRunStatus?: string | null
  }
}

const DEFAULT_PACK: HandbookPack = {
  hero: {
    childName: '',
    monthLabel: '',
    heroCopy: '交流、任务反馈与随笔会在这里慢慢收成你们家自己的成长回忆。',
    pageCount: 0,
    weekPageDelta: 0,
  },
  stats: { highlightCount: 0, completenessPct: 0, memoryCount: 0 },
  handbook: null,
  memoryFeed: [],
  memoryFeedRecent: [],
  memoryFeedPreview: [],
  highlightMoments: [],
  timeCapsule: null,
  archiveWeeks: [],
  refreshedAt: '',
  watermark: { handbookStale: true, memoryStale: true, partiallyRefreshing: false },
}

export default function ProfilePage() {
  useTabBar('profile')
  usePublicPageShare({
    title: '育见 · 成长手账',
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
  const [handbookPack, setHandbookPack] = useState<HandbookPack>(DEFAULT_PACK)
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)
  const [updateNotice, setUpdateNotice] = useState('')
  const [partialRefreshing, setPartialRefreshing] = useState(false)
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

  const applyHubData = useCallback((data: HubPayload | undefined) => {
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
    if (data.coreJudgment) {
      setCoreJudgment(data.coreJudgment)
      setCompleteness(typeof data.completeness === 'number' ? data.completeness : 0)
      setProfileReady(true)
    }
    if (data.supportFocus) setSupportFocus(data.supportFocus)
    if (data.currentFocus) setCurrentFocus(data.currentFocus)
    const wm = data.presentationWatermark
    setPartialRefreshing(Boolean(wm?.partiallyRefreshing))
  }, [])

  const applyHandbookPack = useCallback((data: HandbookPack | undefined) => {
    if (!data) return
    setHandbookPack(data)
    writeLastHandbookPack(data)
    if (typeof data.stats.completenessPct === 'number' && data.stats.completenessPct > 0) {
      setCompleteness(data.stats.completenessPct)
    }
  }, [])

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
        const pack = cached.handbookPack as { ok?: boolean; data?: HandbookPack } | null
        if (pack?.ok) applyHandbookPack(pack.data)
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

      const [snapshot, hub, handbookRes] = await Promise.all([
        apiRequest<{ currentFocus?: string }>('/api/profile/snapshot', { method: 'GET' }),
        apiRequest<HubPayload>('/api/profile/hub', { method: 'GET' }),
        apiRequest<HandbookPack>('/api/profile/handbook-pack', { method: 'GET' }),
      ])

      writeProfileTabCache({ snapshot, hub, handbookPack: handbookRes })

      if (hub.ok) {
        applyHubData(hub.data)
        const cachedVersion = (
          cached?.hub as { ok?: boolean; data?: HubPayload } | null | undefined
        )?.data?.presentationWatermark?.compositeVersion
        const nextVersion = hub.data?.presentationWatermark?.compositeVersion
        if (cachedVersion && nextVersion && cachedVersion !== nextVersion) {
          setUpdateNotice('手账已根据最新记录更新')
          setTimeout(() => setUpdateNotice(''), 4000)
        }
      } else {
        setHubError(hub.error.message || '画像暂时加载失败')
      }

      if (handbookRes.ok) applyHandbookPack(handbookRes.data)
      if (snapshot.ok && snapshot.data.currentFocus) setCurrentFocus(snapshot.data.currentFocus)

      if (showLoading) setRefreshing(false)
    },
    [applyHandbookPack, applyHubData, refreshing, syncLocalProfile]
  )

  const bootedRef = useRef(false)
  const lastRefreshAtRef = useRef(0)

  const runDisplayRefresh = useCallback(
    async (prevAt: string | null) => {
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
        setUpdateNotice('手账已根据最新交流更新')
        setTimeout(() => setUpdateNotice(''), 4000)
      }
    },
    [refreshProfile]
  )

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
        const pack = cached.handbookPack as { ok?: boolean; data?: HandbookPack } | null
        if (pack?.ok) applyHandbookPack(pack.data)
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

  const nav = (url: string) => {
    void Taro.navigateTo({ url })
  }

  const openCard = (slug: string) => {
    nav(`/pages/profile/card/index?id=${encodeURIComponent(slug)}`)
  }

  const hero = handbookPack.hero
  const stats = handbookPack.stats

  return (
    <HiFiMainShell surface='white'>
      <View className='profile-revamp'>
        {refreshedAt ? (
          <Text className='profile-refreshed-at'>上次整理：{formatRefreshedAt(refreshedAt)}</Text>
        ) : null}
        {backgroundRefreshing ? <Text className='muted'>后台整理中…</Text> : null}
        {handbookPack.watermark.handbookRefreshing ? (
          <Text className='update-notice update-notice--pending'>
            手账记忆正在根据过往交流重新整理…
          </Text>
        ) : null}
        {partialRefreshing && !backgroundRefreshing && !handbookPack.watermark.handbookRefreshing ? (
          <Text className='update-notice update-notice--pending'>部分卡片仍在根据最新记录更新</Text>
        ) : null}
        {updateNotice ? <Text className='update-notice'>{updateNotice}</Text> : null}

        {hubLoading ? (
          <View className='loading-wrap'>
            <View className='loader' />
            <Text className='muted'>正在整理成长手账…</Text>
          </View>
        ) : (
          <>
            <PortraitMemoryHero
              childName={hero.childName}
              monthLabel={hero.monthLabel}
              heroCopy={hero.heroCopy}
              pageCount={hero.pageCount}
              weekPageDelta={hero.weekPageDelta}
              highlightCount={stats.highlightCount}
              completenessPct={stats.completenessPct || completeness}
              memoryCount={stats.memoryCount}
              onOpenHandbook={() => nav('/pages/profile/memories/index')}
              onOpenMoments={() => nav('/pages/profile/moments/index')}
              onOpenInsight={() => nav('/pages/profile/insight/index')}
              onOpenMemories={() => nav('/pages/profile/memories/index')}
            />

            <PortraitTileStrip
              cards={profileCards}
              onOpenCard={openCard}
              onOpenAll={() => nav('/pages/profile/insight/index')}
            />

            <WeeklyHandbookCard
              handbook={handbookPack.handbook}
              timeCapsule={handbookPack.timeCapsule}
              previewItems={handbookPack.memoryFeedPreview}
              onOpenHandbook={() => nav('/pages/profile/handbook/index')}
              onOpenMemories={() => nav('/pages/profile/memories/index?scope=recent')}
              onOpenTimeCapsule={() => nav('/pages/profile/time-capsule/index')}
            />

            {hubError && !profileCards.length ? (
              <View className='hifi-card profile-error-card'>
                <Text className='muted'>{hubError}</Text>
              </View>
            ) : null}
          </>
        )}

        {!hasLocalProfile && !hubLoading ? (
          <Text className='pill refresh-pill' onClick={() => void refreshProfile(true)}>
            {refreshing ? '正在刷新…' : '刷新手账'}
          </Text>
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
            <Text className='setting-row' onClick={() => nav('/pages/profile/memories/index')}>
              查看手账记忆 ›
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
      </View>

      <ProfileEditModals kind={modal} onClose={() => setModal(null)} />
    </HiFiMainShell>
  )
}

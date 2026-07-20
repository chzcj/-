'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import {
  DEFAULT_HANDBOOK_PACK,
  PortraitMemoryHero,
  PortraitTileStrip,
  WeeklyHandbookCard,
} from '@/components/profile/PortraitRevamp'
import { ProfileEditModals, type EditModalKind } from '@/components/profile/ProfileEditModals'
import { buildHubProfileCards } from '@/lib/profile/hub-profile-cards'
import { readProfileTabCache, writeProfileTabCache } from '@/lib/profile-tab-cache'
import { getLatestProfile, hasProfile, hydrateProfileFromRemote } from '@/lib/storage/profileStorage'
import type { HandbookPack } from '@/types/handbook-pack'
import type { StructuralTension } from '@/types/deep-model-digest'
import type { DailyPortraitCards } from '@/types/portrait-card'
import './portrait-revamp.css'

function formatRefreshedAt(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (sameDay) return `今天 ${time}`
    return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`
  } catch {
    return iso
  }
}

export default function FamilyProfilePage() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [completeness, setCompleteness] = useState(0)
  const [coreJudgment, setCoreJudgment] = useState('')
  const [supportFocus, setSupportFocus] = useState('')
  const [currentFocus, setCurrentFocus] = useState('')
  const [editModal, setEditModal] = useState<EditModalKind | null>(null)
  const [hubCards, setHubCards] = useState<{
    interactionPattern?: string
    effectiveStrategies?: string
    pendingHypotheses?: string
    behaviorSummary?: string
    hasRealData?: boolean
  }>({})
  const [portraitCards, setPortraitCards] = useState<DailyPortraitCards>({})
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [hubLoading, setHubLoading] = useState(true)
  const [hubError, setHubError] = useState('')
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)
  const [updateNotice, setUpdateNotice] = useState('')
  const [structuralTensions, setStructuralTensions] = useState<StructuralTension[]>([])
  const [handbookPack, setHandbookPack] = useState<HandbookPack>(DEFAULT_HANDBOOK_PACK)

  const applyHubData = useCallback((hub: { ok?: boolean; data?: Record<string, unknown> } | null) => {
    if (!hub?.ok || !hub.data) return
    const d = hub.data
    setHubCards({
      interactionPattern: d.interactionPattern as string | undefined,
      effectiveStrategies: d.effectiveStrategies as string | undefined,
      pendingHypotheses: d.pendingHypotheses as string | undefined,
      behaviorSummary: d.behaviorSummary as string | undefined,
      hasRealData: d.hasRealData as boolean | undefined,
    })
    if (d.portraitCards) setPortraitCards(d.portraitCards as DailyPortraitCards)
    if (d.refreshedAt !== undefined) setRefreshedAt(d.refreshedAt as string | null)
    if (Array.isArray(d.structuralTensions)) {
      setStructuralTensions(d.structuralTensions as StructuralTension[])
    }
    if (d.coreJudgment) {
      setCoreJudgment(d.coreJudgment as string)
      setCompleteness((d.completeness as number) || 0)
      setProfileReady(true)
    }
    if (d.supportFocus) setSupportFocus(d.supportFocus as string)
    if (d.currentFocus) setCurrentFocus(d.currentFocus as string)
  }, [])

  const applyHandbookPack = useCallback((res: { ok?: boolean; data?: HandbookPack } | null) => {
    if (!res?.ok || !res.data) return
    setHandbookPack(res.data)
    if (typeof res.data.stats.completenessPct === 'number' && res.data.stats.completenessPct > 0) {
      setCompleteness(res.data.stats.completenessPct)
    }
  }, [])

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

  const refreshProfile = useCallback(
    async (showLoading = true, forceNetwork = false) => {
      if (refreshing) return

      const cached = readProfileTabCache()
      if (cached && !showLoading && !forceNetwork) {
        syncLocalProfile()
        applyHubData(cached.hub as { ok?: boolean; data?: Record<string, unknown> } | null)
        applyHandbookPack(cached.handbookPack as { ok?: boolean; data?: HandbookPack } | null)
        return
      }

      if (showLoading) setRefreshing(true)
      setHubError('')

      if (!syncLocalProfile()) {
        try {
          const built = await fetch('/api/profile/built', { credentials: 'include' }).then((r) => r.json())
          writeProfileTabCache({ built })
          if (built.ok && built.data?.snapshot?.coreJudgment) {
            hydrateProfileFromRemote(built.data.snapshot)
            syncLocalProfile()
          }
        } catch {
          /* ignore */
        }
      }

      const [snapshot, hub, handbookRes] = await Promise.all([
        fetch('/api/profile/snapshot', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch('/api/profile/hub', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch('/api/profile/handbook-pack', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      ])

      writeProfileTabCache({ snapshot, hub, handbookPack: handbookRes })

      if (hub?.ok) {
        applyHubData(hub)
      } else {
        setHubError(hub?.error?.message || '画像暂时加载失败')
      }
      applyHandbookPack(handbookRes)

      if (snapshot?.ok && snapshot.data?.currentFocus) setCurrentFocus(snapshot.data.currentFocus)

      if (showLoading) setRefreshing(false)
    },
    [applyHandbookPack, applyHubData, refreshing, syncLocalProfile]
  )

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      const cached = readProfileTabCache()
      if (cached) {
        syncLocalProfile()
        applyHubData(cached.hub as { ok?: boolean; data?: Record<string, unknown> } | null)
        applyHandbookPack(cached.handbookPack as { ok?: boolean; data?: HandbookPack } | null)
        setHubLoading(false)
      } else {
        setHubLoading(true)
        await refreshProfile(true)
        if (!cancelled) setHubLoading(false)
      }

      if (cancelled) return
      const prevAt =
        (readProfileTabCache()?.hub as { ok?: boolean; data?: { refreshedAt?: string } } | null)?.data
          ?.refreshedAt || null
      setBackgroundRefreshing(true)
      try {
        await fetch('/api/account/daily-refresh', { method: 'POST', credentials: 'include' })
      } catch {
        /* ignore */
      }
      if (cancelled) return
      await refreshProfile(false, true)
      if (!cancelled) {
        setBackgroundRefreshing(false)
        const nextAt = (
          readProfileTabCache()?.hub as { ok?: boolean; data?: { refreshedAt?: string } } | null
        )?.data?.refreshedAt
        if (nextAt && prevAt && nextAt !== prevAt) {
          setUpdateNotice('手账已根据最新交流更新')
          window.setTimeout(() => setUpdateNotice(''), 4000)
        }
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [applyHandbookPack, applyHubData, refreshProfile, syncLocalProfile])

  const hasLocalProfile = profileReady || hasProfile()
  const profileCards = useMemo(
    () =>
      buildHubProfileCards({
        portraitCards,
        hubCards,
        structuralTensions,
        hasLocalProfile,
        completeness,
        coreJudgment,
        supportFocus,
        currentFocus,
      }),
    [
      portraitCards,
      hubCards,
      structuralTensions,
      hasLocalProfile,
      completeness,
      coreJudgment,
      supportFocus,
      currentFocus,
    ]
  )

  const hero = handbookPack.hero
  const stats = handbookPack.stats

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile" surface="white">
        <div className="profile-revamp">
          {refreshedAt ? (
            <p className="profile-refreshed-at">上次整理：{formatRefreshedAt(refreshedAt)}</p>
          ) : null}
          {backgroundRefreshing ? <p className="hint-text">后台整理中…</p> : null}
          {handbookPack.watermark.handbookRefreshing ? (
            <p className="hint-text update-notice-pending">
              手账记忆正在根据过往交流重新整理…
            </p>
          ) : null}
          {updateNotice ? (
            <p className="hint-text" style={{ color: '#6f9f56' }}>
              {updateNotice}
            </p>
          ) : null}

          {hubLoading ? (
            <div className="loading-wrap" style={{ padding: '24px 0' }}>
              <div className="loader" aria-hidden="true" />
              <p className="hint-text">正在整理成长手账…</p>
            </div>
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
                onOpenHandbook={() => router.push('/family-profile/memories')}
                onOpenMoments={() => router.push('/family-profile/moments')}
                onOpenInsight={() => router.push('/family-profile/insight')}
                onOpenMemories={() => router.push('/family-profile/memories')}
              />

              <PortraitTileStrip
                cards={profileCards}
                onOpenCard={(slug) => router.push(`/family-profile/${slug}`)}
                onOpenAll={() => router.push('/family-profile/insight')}
              />

              <WeeklyHandbookCard
                handbook={handbookPack.handbook}
                timeCapsule={handbookPack.timeCapsule}
                previewItems={handbookPack.memoryFeedPreview}
                onOpenHandbook={() => router.push('/family-profile/handbook')}
                onOpenMemories={(e) => {
                  e.stopPropagation()
                  router.push('/family-profile/memories?scope=recent')
                }}
                onOpenTimeCapsule={() => router.push('/family-profile/time-capsule')}
              />

              {hubError && !profileCards.length ? (
                <p className="hint-text">{hubError}</p>
              ) : null}
            </>
          )}

          {!hasLocalProfile && !hubLoading ? (
            <button type="button" className="quiet-button" style={{ marginTop: 12 }} onClick={() => void refreshProfile(true)}>
              {refreshing ? '正在刷新…' : '刷新手账'}
            </button>
          ) : null}

          <span className="section-label">画像维护</span>
          <div className="setting-group">
            <button type="button" className="setting-row" onClick={() => router.push('/profile/build')}>
              <span>补充画像 ›</span>
            </button>
            <button type="button" className="setting-row" onClick={() => router.push('/family-profile/memories')}>
              <span>查看手账记忆 ›</span>
            </button>
          </div>

          <span className="section-label">账号管理</span>
          <div className="setting-group account-actions">
            <button type="button" className="setting-row" onClick={() => setEditModal('profile')}>
              <span>编辑个人资料</span>
              <span className="account-chevron" aria-hidden="true">›</span>
            </button>
            <button type="button" className="setting-row" onClick={() => setEditModal('child')}>
              <span>编辑孩子信息</span>
              <span className="account-chevron" aria-hidden="true">›</span>
            </button>
            <button type="button" className="setting-row" onClick={() => setEditModal('password')}>
              <span>修改密码</span>
              <span className="account-chevron" aria-hidden="true">›</span>
            </button>
            <button type="button" className="setting-row account-row-danger" onClick={() => setEditModal('delete')}>
              <span>注销账号</span>
              <span className="account-chevron" aria-hidden="true">›</span>
            </button>
          </div>
        </div>

        <ProfileEditModals
          kind={editModal}
          onClose={() => setEditModal(null)}
          onLoggedOut={() => router.push('/login')}
        />
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

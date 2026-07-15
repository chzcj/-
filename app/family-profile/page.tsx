'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { ProfileEditModals, type EditModalKind } from '@/components/profile/ProfileEditModals'
import { apiClient } from '@/lib/api-client'
import { readProfileTabCache, writeProfileTabCache } from '@/lib/profile-tab-cache'
import { getLatestProfile, hasProfile, hydrateProfileFromRemote } from '@/lib/storage/profileStorage'
import type { StructuralTension } from '@/types/deep-model-digest'
import {
  portraitCardSummary,
  truncateSummary,
  type DailyPortraitCards,
} from '@/types/portrait-card'

function truncate(text: string, max = 160) {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}…`
}

function formatRefreshedAt(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (sameDay) return `今天 ${time}`
    const month = d.getMonth() + 1
    const day = d.getDate()
    return `${month}月${day}日 ${time}`
  } catch {
    return iso
  }
}


function cardSummary(
  card: DailyPortraitCards[keyof DailyPortraitCards],
  fallback: string
): string {
  const fromPortrait = portraitCardSummary(card)
  if (fromPortrait) return fromPortrait
  const fb = fallback.trim()
  return fb ? truncateSummary(fb, 56) : ''
}

function hasCardContent(
  card: DailyPortraitCards[keyof DailyPortraitCards],
  fallback = ''
): boolean {
  return Boolean(portraitCardSummary(card) || fallback.trim())
}

export default function FamilyProfilePage() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [completeness, setCompleteness] = useState(0)
  const [coreJudgment, setCoreJudgment] = useState('')
  const [supportFocus, setSupportFocus] = useState('')
  const [currentFocus, setCurrentFocus] = useState('')
  const [recentTitle, setRecentTitle] = useState('')
  const [weeklySummary, setWeeklySummary] = useState('')
  const [editModal, setEditModal] = useState<EditModalKind | null>(null)

  const [hubCards, setHubCards] = useState<{
    interactionPattern?: string
    effectiveStrategies?: string
    pendingHypotheses?: string
    behaviorSummary?: string
    hasRealData?: boolean
  }>({})
  // daily-refresh Agent 产出的人话卡片摘要 + 上次整理时间
  const [portraitCards, setPortraitCards] = useState<DailyPortraitCards>({})
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [pendingList, setPendingList] = useState<string[]>([])
  const [hubLoading, setHubLoading] = useState(true)
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)
  const [updateNotice, setUpdateNotice] = useState('')
  const [structuralTensions, setStructuralTensions] = useState<StructuralTension[]>([])

  function applyHubData(hub: { ok?: boolean; data?: Record<string, unknown> } | null) {
    if (!hub?.ok || !hub.data) return
    const d = hub.data
    setHubCards({
      interactionPattern: d.interactionPattern as string | undefined,
      effectiveStrategies: d.effectiveStrategies as string | undefined,
      pendingHypotheses: d.pendingHypotheses as string | undefined,
      behaviorSummary: d.behaviorSummary as string | undefined,
      hasRealData: d.hasRealData as boolean | undefined,
    })
    if (d.portraitCards) setPortraitCards(d.portraitCards as typeof portraitCards)
    if (d.refreshedAt !== undefined) setRefreshedAt(d.refreshedAt as string | null)
    if (d.pendingHypothesesList) setPendingList(d.pendingHypothesesList as string[])
    if (Array.isArray(d.structuralTensions)) {
      setStructuralTensions(d.structuralTensions as StructuralTension[])
    }
    if (d.coreJudgment) {
      setCoreJudgment(d.coreJudgment as string)
      setCompleteness((d.completeness as number) || 0)
      setProfileReady(true)
    }
  }

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

  const refreshProfile = useCallback(async (showLoading = true, forceNetwork = false) => {
    if (refreshing) return

    const cached = readProfileTabCache()
    if (cached && !showLoading && !forceNetwork) {
      const built = cached.built as { ok?: boolean; data?: { snapshot?: { coreJudgment?: string } } } | null
      if (built?.ok && built.data?.snapshot?.coreJudgment) {
        hydrateProfileFromRemote(built.data.snapshot as never)
        syncLocalProfile()
      }
      const snap = cached.snapshot as { ok?: boolean; data?: { currentFocus?: string; recentChanges?: { title: string }[] } }
      if (snap?.ok) {
        if (snap.data?.currentFocus) setCurrentFocus(snap.data.currentFocus)
        if (snap.data?.recentChanges?.[0]) setRecentTitle(snap.data.recentChanges[0].title)
      }
      const wk = cached.weekly as { ok?: boolean; data?: { weeklySummary?: string } }
      if (wk?.ok && wk.data?.weeklySummary) setWeeklySummary(wk.data.weeklySummary)
      applyHubData(cached.hub as { ok?: boolean; data?: Record<string, unknown> } | null)
      return
    }

    if (showLoading) setRefreshing(true)

    if (!syncLocalProfile()) {
      try {
        const built = await fetch('/api/profile/built').then((r) => r.json())
        writeProfileTabCache({ built })
        if (built.ok && built.data?.snapshot?.coreJudgment) {
          hydrateProfileFromRemote(built.data.snapshot)
          syncLocalProfile()
        }
      } catch {
        /* ignore */
      }
    }

    const [snapshot, weekly, hub] = await Promise.all([
      apiClient.getProfileSnapshot(),
      apiClient.getWeeklyReview(),
      fetch('/api/profile/hub', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
    ])
    writeProfileTabCache({ snapshot, weekly, hub })

    applyHubData(hub)

    if (snapshot.ok) {
      if (snapshot.data.currentFocus) setCurrentFocus(snapshot.data.currentFocus)
      if (snapshot.data.recentChanges?.[0]) {
        setRecentTitle(snapshot.data.recentChanges[0].title)
      }
    }

    if (weekly.ok) {
      setWeeklySummary(weekly.data.weeklySummary)
    }

    if (showLoading) setRefreshing(false)
  }, [refreshing, syncLocalProfile])

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      const cached = readProfileTabCache()
      if (cached) {
        syncLocalProfile()
        const built = cached.built as { ok?: boolean; data?: { snapshot?: { coreJudgment?: string } } } | null
        if (built?.ok && built.data?.snapshot?.coreJudgment) {
          hydrateProfileFromRemote(built.data.snapshot as never)
          syncLocalProfile()
        }
        const snap = cached.snapshot as { ok?: boolean; data?: { currentFocus?: string; recentChanges?: { title: string }[] } }
        if (snap?.ok) {
          if (snap.data?.currentFocus) setCurrentFocus(snap.data.currentFocus)
          if (snap.data?.recentChanges?.[0]) setRecentTitle(snap.data.recentChanges[0].title)
        }
        const wk = cached.weekly as { ok?: boolean; data?: { weeklySummary?: string } }
        if (wk?.ok && wk.data?.weeklySummary) setWeeklySummary(wk.data.weeklySummary)
        applyHubData(cached.hub as { ok?: boolean; data?: Record<string, unknown> } | null)
        setHubLoading(false)
      } else {
        setHubLoading(true)
        await refreshProfile(true)
        if (!cancelled) setHubLoading(false)
      }

      if (cancelled) return
      const cachedHub = readProfileTabCache()?.hub as { ok?: boolean; data?: { refreshedAt?: string } } | null
      const prevAt = cachedHub?.data?.refreshedAt || null
      setBackgroundRefreshing(true)
      try {
        await fetch('/api/account/daily-refresh', { method: 'POST', credentials: 'include' })
      } catch {
        /* 后台刷新失败不阻塞首屏 */
      }
      if (cancelled) return
      await refreshProfile(false, true)
      if (!cancelled) {
        setBackgroundRefreshing(false)
        const hub = readProfileTabCache()?.hub as { ok?: boolean; data?: { refreshedAt?: string } } | null
        const nextAt = hub?.data?.refreshedAt
        if (nextAt && prevAt && nextAt !== prevAt) {
          setUpdateNotice('画像已根据最新交流更新')
          window.setTimeout(() => setUpdateNotice(''), 4000)
        }
      }
    }
    void boot()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once; refreshedAt read for diff only
  }, [refreshProfile, syncLocalProfile])

  const hasLocalProfile = profileReady || hasProfile()
  const focusText = supportFocus || currentFocus || (hubCards.hasRealData ? '' : '完成交流后，关注点会在这里更新。')
  const growthText = hasLocalProfile && coreJudgment
    ? truncate(coreJudgment, 180)
    : '记录、任务反馈和演练结果都会先成为观察线索，再进入画像更新。'

  const profileCards = [
    {
      title: '动态成长画像',
      slug: 'growth',
      body: cardSummary(portraitCards.growth, growthText),
      progress: completeness,
      progressHint:
        completeness >= 100
          ? '画像已基本完整，持续交流会继续精修细节。'
          : `已收集 ${completeness}%，继续交流/记录补全剩余 ${100 - completeness}%。`,
    },
    {
      title: '当前关注点',
      slug: 'focus',
      body: cardSummary(portraitCards.focus, focusText || truncate(coreJudgment || '暂无', 80)),
      progress: hasCardContent(portraitCards.focus, focusText) ? 55 : 8,
      progressHint: hasCardContent(portraitCards.focus, focusText) ? '已基于已记录交流生成，继续使用会越来越准。' : '完成更多交流后，关注点会在这里更新。',
    },
    {
      title: '行为模式总结',
      slug: 'behavior',
      body: cardSummary(portraitCards.behavior, hubCards.behaviorSummary || (hasLocalProfile && coreJudgment ? truncate(coreJudgment, 120) : '交流积累后，会在这里看到模式总结。')),
      progress: hasCardContent(portraitCards.behavior, hubCards.behaviorSummary || '') ? 55 : 8,
      progressHint: hasCardContent(portraitCards.behavior, hubCards.behaviorSummary || '') ? '已从交流中提取行为模式，继续记录会持续修正。' : '完成几次交流后，这里会出现孩子的行为模式总结。',
    },
    {
      title: '家庭互动模式',
      slug: 'interaction',
      body: cardSummary(portraitCards.interaction, hubCards.interactionPattern || (hubCards.hasRealData ? '' : '完成画像与多轮交流后更新。')),
      progress: hasCardContent(portraitCards.interaction, hubCards.interactionPattern || '') ? 55 : 8,
      progressHint: hasCardContent(portraitCards.interaction, hubCards.interactionPattern || '') ? '已识别家庭互动循环，多轮交流后会越来越清晰。' : '完成画像建模 + 多轮交流后，这里会展示你们家的互动模式。',
    },
    {
      title: '有效策略',
      slug: 'strategies',
      body: cardSummary(portraitCards.strategies, hubCards.effectiveStrategies || (hubCards.hasRealData ? '' : '来自任务反馈与交流的验证策略会出现在这里。')),
      progress: hasCardContent(portraitCards.strategies, hubCards.effectiveStrategies || '') ? 55 : 8,
      progressHint: hasCardContent(portraitCards.strategies, hubCards.effectiveStrategies || '') ? '已积累验证过的策略，继续反馈任务结果会扩充。' : '试过任务后回来反馈，验证有效的策略会出现在这里。',
    },
    {
      title: '家庭运转张力',
      slug: 'tensions',
      body: cardSummary(
        portraitCards.tensions,
        structuralTensions[0]
          ? truncateSummary(`${structuralTensions[0].title}：${structuralTensions[0].detail}`, 56)
          : ''
      ),
      progress: hasCardContent(
        portraitCards.tensions,
        structuralTensions[0] ? `${structuralTensions[0].title}：${structuralTensions[0].detail}` : ''
      )
        ? 50
        : structuralTensions.length
          ? 40
          : 8,
      progressHint: hasCardContent(
        portraitCards.tensions,
        structuralTensions[0] ? `${structuralTensions[0].title}：${structuralTensions[0].detail}` : ''
      )
        ? '这些运转方式可能在消耗孩子精力，后续交流会继续修正。'
        : structuralTensions.length
          ? '正在把分析整理成更好读的话…'
          : '深度建模完成后，可能消耗孩子的家庭运转方式会出现在这里。',
    },
    {
      title: '孩子写作业的机制',
      slug: 'hypotheses',
      body: cardSummary(
        portraitCards.hypotheses,
        hubCards.pendingHypotheses || (hubCards.hasRealData ? '' : '作业场景下的机制与可试做法会列在这里。')
      ),
      progress: hasCardContent(portraitCards.hypotheses, hubCards.pendingHypotheses || '') ? 40 : 8,
      progressHint: hasCardContent(portraitCards.hypotheses, hubCards.pendingHypotheses || '')
        ? '围绕写作业场景整理机制与做法，后续交流会修正。'
        : '持续交流后，会补充写作业相关的机制与可试做法。',
    },
  ].filter((card) => card.body.trim().length > 0)

  const trendItems = [recentTitle, weeklySummary ? truncate(weeklySummary, 48) : ''].filter(Boolean)

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile" surface="white">
        <section className="section">
          <h2 className="section-title">
            画像数据中心
            {refreshedAt ? (
              <span className="profile-refreshed-at">上次整理：{formatRefreshedAt(refreshedAt)}</span>
            ) : null}
            {backgroundRefreshing ? (
              <span className="profile-refreshed-at"> · 后台整理中</span>
            ) : null}
          </h2>
          {updateNotice ? (
            <p className="hint-text" style={{ marginTop: 4, color: '#6f9f56' }}>{updateNotice}</p>
          ) : null}
          <div className="profile-data-grid">
            {hubLoading ? (
              <div className="loading-wrap" style={{ gridColumn: '1 / -1', padding: '24px 0' }}>
                <div className="loader" aria-hidden="true" />
                <p className="hint-text">正在整理今日画像…</p>
              </div>
            ) : (
              profileCards.map((card) => (
                <div
                  key={card.title}
                  className="profile-data-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/family-profile/${card.slug}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/family-profile/${card.slug}`)
                    }
                  }}
                >
                  <h3>
                    {card.title}
                    {card.title === '动态成长画像' && hasLocalProfile ? ` · ${completeness}%` : ''}
                    <span className="card-chevron" aria-hidden="true">▸</span>
                  </h3>
                  <p className="profile-card-summary">{card.body}</p>
                  <div className="card-progress-detail">
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${card.progress}%` }} />
                    </div>
                    <p className="progress-hint">{card.progressHint}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {!hasLocalProfile ? (
            <button type="button" className="quiet-button" style={{ marginTop: 12 }} onClick={() => void refreshProfile(true)}>
              {refreshing ? '正在刷新…' : '刷新画像'}
            </button>
          ) : null}
        </section>
        <section className="section">
          <h2 className="section-title">孩子最近变化</h2>
          <div className="profile-block">
            {trendItems.length > 0 ? (
              <ul>
                {trendItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="hint-text">继续交流后，最近变化会在这里更新。</p>
            )}
          </div>
        </section>

        {pendingList.length > 0 && !hasCardContent(portraitCards.hypotheses, hubCards.pendingHypotheses || '') ? (
          <section className="section">
            <h2 className="section-title">待确认观点</h2>
            <div className="profile-block">
              <ul>
                {pendingList.map((item) => (
                  <li key={item}>
                    <button type="button" className="link-button" onClick={() => router.push('/family-profile/hypotheses')}>
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="section">
          <h2 className="section-title">相关操作</h2>
          <div className="end-actions">
            <button type="button" className="secondary-button" onClick={() => router.push('/profile/result')} disabled={!hasLocalProfile}>
              查看完整画像
            </button>
            <button type="button" className="secondary-button" onClick={() => router.push('/profile/deep')} disabled={!hasLocalProfile}>
              机制链解释
            </button>
            <button type="button" className="primary-button" onClick={() => router.push('/rehearsal')}>
              沟通预演
            </button>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">账号管理</h2>
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
        </section>

        <ProfileEditModals
          kind={editModal}
          onClose={() => setEditModal(null)}
          onLoggedOut={() => router.push('/login')}
        />
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

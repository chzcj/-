'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { ProfileEditModals, type EditModalKind } from '@/components/profile/ProfileEditModals'
import { apiClient } from '@/lib/api-client'
import { readProfileTabCache, writeProfileTabCache } from '@/lib/profile-tab-cache'
import { getLatestProfile, hasProfile, hydrateProfileFromRemote } from '@/lib/storage/profileStorage'

function truncate(text: string, max = 160) {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}…`
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
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [editModal, setEditModal] = useState<EditModalKind | null>(null)

  const [hubCards, setHubCards] = useState<{
    interactionPattern?: string
    effectiveStrategies?: string
    pendingHypotheses?: string
    behaviorSummary?: string
    hasRealData?: boolean
  }>({})

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

  const refreshProfile = useCallback(async (showLoading = true) => {
    if (refreshing) return

    const cached = readProfileTabCache()
    if (cached) {
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
      if (showLoading) setRefreshing(false)
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
      fetch('/api/profile/hub').then((r) => r.json()).catch(() => null),
    ])
    writeProfileTabCache({ snapshot, weekly })

    if (hub?.ok && hub.data) {
      setHubCards({
        interactionPattern: hub.data.interactionPattern,
        effectiveStrategies: hub.data.effectiveStrategies,
        pendingHypotheses: hub.data.pendingHypotheses,
        behaviorSummary: hub.data.behaviorSummary,
        hasRealData: hub.data.hasRealData,
      })
      if (hub.data.coreJudgment) {
        setCoreJudgment(hub.data.coreJudgment)
        setCompleteness(hub.data.completeness || 0)
        setProfileReady(true)
      }
    }

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
    void refreshProfile(false)
  }, [refreshProfile])

  const hasLocalProfile = profileReady || hasProfile()
  const focusText = supportFocus || currentFocus || (hubCards.hasRealData ? '' : '完成交流后，关注点会在这里更新。')
  const growthText = hasLocalProfile && coreJudgment
    ? truncate(coreJudgment, 180)
    : '记录、任务反馈和演练结果都会先成为观察线索，再进入画像更新。'

  const profileCards = [
    {
      title: '动态成长画像',
      body: growthText,
      progress: completeness,
      progressHint:
        completeness >= 100
          ? '画像已基本完整，持续交流会继续精修细节。'
          : `已收集 ${completeness}%，继续交流/记录补全剩余 ${100 - completeness}%。`,
    },
    {
      title: '当前关注点',
      body: focusText || truncate(coreJudgment || '暂无', 80),
      progress: focusText ? 55 : 8,
      progressHint: focusText ? '已基于已记录交流生成，继续使用会越来越准。' : '完成更多交流后，关注点会在这里更新。',
    },
    {
      title: '行为模式总结',
      body: hubCards.behaviorSummary || (hasLocalProfile && coreJudgment ? truncate(coreJudgment, 120) : '交流积累后，会在这里看到模式总结。'),
      progress: hubCards.behaviorSummary ? 55 : 8,
      progressHint: hubCards.behaviorSummary ? '已从交流中提取行为模式，继续记录会持续修正。' : '完成几次交流后，这里会出现孩子的行为模式总结。',
    },
    {
      title: '家庭互动模式',
      body: hubCards.interactionPattern || (hubCards.hasRealData ? '' : '完成画像与多轮交流后更新。'),
      progress: hubCards.interactionPattern ? 55 : 8,
      progressHint: hubCards.interactionPattern ? '已识别家庭互动循环，多轮交流后会越来越清晰。' : '完成画像建模 + 多轮交流后，这里会展示你们家的互动模式。',
    },
    {
      title: '有效策略',
      body: hubCards.effectiveStrategies || (hubCards.hasRealData ? '' : '来自任务反馈与交流的验证策略会出现在这里。'),
      progress: hubCards.effectiveStrategies ? 55 : 8,
      progressHint: hubCards.effectiveStrategies ? '已积累验证过的策略，继续反馈任务结果会扩充。' : '试过任务后回来反馈，验证有效的策略会出现在这里。',
    },
    {
      title: '待验证假设',
      body: hubCards.pendingHypotheses || (hubCards.hasRealData ? '' : '仍在观察中的判断会列在这里。'),
      progress: hubCards.pendingHypotheses ? 40 : 8,
      progressHint: hubCards.pendingHypotheses ? '这些判断仍在观察中，后续交流会帮助确认或修正。' : '持续交流后，系统会提出待验证的判断供你留意。',
    },
  ].filter((card) => card.body.trim().length > 0)

  const trendItems = [
    recentTitle || '冲突次数减少',
    weeklySummary ? truncate(weeklySummary, 48) : '作业启动稍改善',
  ].filter(Boolean)

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile">
        <section className="section">
          <h2 className="section-title">画像数据中心</h2>
          <div className="profile-data-grid">
            {profileCards.map((card) => {
              const expanded = expandedCard === card.title
              return (
                <div
                  key={card.title}
                  className={`profile-data-card${expanded ? ' expanded' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedCard(expanded ? null : card.title)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedCard(expanded ? null : card.title)
                    }
                  }}
                >
                  <h3>
                    {card.title}
                    {card.title === '动态成长画像' && hasLocalProfile ? ` · ${completeness}%` : ''}
                    <span className="card-chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                  </h3>
                  <p>{card.body}</p>
                  {expanded && (
                    <div className="card-progress-detail">
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${card.progress}%` }} />
                      </div>
                      <p className="progress-hint">{card.progressHint}</p>
                    </div>
                  )}
                </div>
              )
            })}
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
            <h3>最近变化：</h3>
            <ul>
              {trendItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">待确认观点</h2>
          <div className="profile-block">
            <h3>以下判断仍在观察中</h3>
            <p className="hint-text">当前画像只基于已记录交流和任务反馈，不作为定论。</p>
          </div>
        </section>

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
          <div className="account-actions">
            <div className="account-actions-row">
              <button type="button" className="account-button" onClick={() => setEditModal('profile')}>
                编辑个人资料
              </button>
              <button type="button" className="account-button" onClick={() => setEditModal('child')}>
                编辑孩子信息
              </button>
            </div>
            <button type="button" className="account-button long" onClick={() => setEditModal('password')}>
              修改密码
            </button>
            <button type="button" className="account-button long danger" onClick={() => setEditModal('delete')}>
              注销账号
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

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProfileSubPage } from '../_components/ProfileSubPage'
import { buildHubProfileCards } from '@/lib/profile/hub-profile-cards'
import { getLatestProfile, hasProfile } from '@/lib/storage/profileStorage'
import type { StructuralTension } from '@/types/deep-model-digest'
import type { DailyPortraitCards } from '@/types/portrait-card'

const TILE_BADGE: Record<string, string> = {
  growth: '成长画像',
  focus: '长期关注',
  behavior: '行为模式',
  interaction: '亲子互动',
  strategies: '好方法',
  tensions: '成长阻力',
  hypotheses: '作业机制',
}

export default function InsightPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [childName, setChildName] = useState('孩子')
  const [portraitCards, setPortraitCards] = useState<DailyPortraitCards>({})
  const [hubCards, setHubCards] = useState<Record<string, unknown>>({})
  const [structuralTensions, setStructuralTensions] = useState<StructuralTension[]>([])
  const [completeness, setCompleteness] = useState(0)
  const [coreJudgment, setCoreJudgment] = useState('')
  const [supportFocus, setSupportFocus] = useState('')
  const [currentFocus, setCurrentFocus] = useState('')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const local = getLatestProfile()
      if (local) {
        setCompleteness(local.completeness)
        setCoreJudgment(local.coreJudgment)
        setSupportFocus(local.supportFocus || '')
      }
      const res = await fetch('/api/profile/hub', { credentials: 'include' }).then((r) => r.json())
      if (res.ok) {
        const d = res.data
        setPortraitCards(d.portraitCards || {})
        setStructuralTensions(d.structuralTensions || [])
        setHubCards(d)
        if (d.coreJudgment) setCoreJudgment(d.coreJudgment)
        if (typeof d.completeness === 'number') setCompleteness(d.completeness)
        if (d.supportFocus) setSupportFocus(d.supportFocus)
        if (d.currentFocus) setCurrentFocus(d.currentFocus)
        if (d.childName) setChildName(d.childName)
      }
      setLoading(false)
    })()
  }, [])

  const cards = useMemo(
    () =>
      buildHubProfileCards({
        portraitCards,
        hubCards: hubCards as never,
        structuralTensions,
        hasLocalProfile: Boolean(coreJudgment) || hasProfile(),
        completeness,
        coreJudgment,
        supportFocus,
        currentFocus,
      }),
    [portraitCards, hubCards, structuralTensions, completeness, coreJudgment, supportFocus, currentFocus]
  )

  return (
    <ProfileSubPage title="画像洞察" className="insight-page-wrap">
      {loading ? <p className="hint-text">正在整理…</p> : null}
      {!loading && !cards.length ? (
        <p className="hint-text">完成画像建模后，洞察会在这里展开。</p>
      ) : null}
      {!loading && cards.length ? (
        <>
          <div className="insight-hero">
            <p className="sheet-kicker">育见 · 理解层</p>
            <h3>{childName}的成长画像</h3>
            <p className="sheet-lead" style={{ marginBottom: 0 }}>
              {cards.length} 张卡片，读懂孩子与亲子互动。不是报告墙——是手账里慢慢写厚的理解。
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <strong style={{ fontSize: 28, color: '#6f9f56' }}>{completeness}%</strong>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>整体了解进度</strong>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${completeness}%` }} />
                </div>
              </div>
            </div>
          </div>
          {cards.map((card, index) => {
            const variant = `t${(index % 4) + 1}`
            return (
              <button
                key={card.slug}
                type="button"
                className={`insight-card-web ${variant}`}
                onClick={() => router.push(`/family-profile/${card.slug}`)}
              >
                <div className="ic-top">
                  <span className="sheet-kicker" style={{ display: 'inline-block', marginBottom: 8 }}>
                    {TILE_BADGE[card.slug] || card.title}
                  </span>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{card.title}</h4>
                </div>
                <div style={{ margin: '0 8px 8px', padding: 12, borderRadius: 16, background: 'rgba(255,255,255,0.7)' }}>
                  <p className="mini-card-body">{card.body}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div className="progress-bar-fill" style={{ width: `${card.progress}%` }} />
                    </div>
                    <span className="sheet-kicker" style={{ margin: 0 }}>{card.progress}%</span>
                  </div>
                  <small className="hint-text">{card.progressHint}</small>
                </div>
              </button>
            )
          })}
        </>
      ) : null}
    </ProfileSubPage>
  )
}

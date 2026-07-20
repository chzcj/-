'use client'

import { ArrowLeft } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { buildHubProfileCards } from '@/lib/profile/hub-profile-cards'
import { getLatestProfile, hasProfile } from '@/lib/storage/profileStorage'
import type { StructuralTension } from '@/types/deep-model-digest'
import type { DailyPortraitCards, PortraitCardSection } from '@/types/portrait-card'
import '../portrait-revamp.css'

const TITLES: Record<string, string> = {
  growth: '动态成长画像',
  focus: '当前关注点',
  behavior: '孩子行为模式',
  interaction: '亲子互动关系',
  strategies: '有效策略',
  hypotheses: '孩子写作业的机制',
  tensions: '孩子健康成长阻力',
}

export default function ProfileCardDetailPage() {
  const router = useRouter()
  const params = useParams()
  const card = String(params.card || '')
  const [summary, setSummary] = useState('')
  const [lead, setLead] = useState('')
  const [sections, setSections] = useState<PortraitCardSection[]>([])
  const [facts, setFacts] = useState<string[]>([])
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [completeness, setCompleteness] = useState(0)
  const [portraitCards, setPortraitCards] = useState<DailyPortraitCards>({})
  const [hubCards, setHubCards] = useState<Record<string, unknown>>({})
  const [structuralTensions, setStructuralTensions] = useState<StructuralTension[]>([])
  const [coreJudgment, setCoreJudgment] = useState('')
  const [supportFocus, setSupportFocus] = useState('')
  const [currentFocus, setCurrentFocus] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const local = getLatestProfile()
      if (local) {
        setCompleteness(local.completeness)
        setCoreJudgment(local.coreJudgment)
        setSupportFocus(local.supportFocus || '')
      }
      try {
        const [cardRes, hubRes] = await Promise.all([
          fetch(`/api/profile/card/${card}`, { credentials: 'include' }).then((r) => r.json()),
          fetch('/api/profile/hub', { credentials: 'include' }).then((r) => r.json()),
        ])
        if (cancelled) return
        if (hubRes.ok && hubRes.data) {
          const d = hubRes.data
          setPortraitCards(d.portraitCards || {})
          setStructuralTensions(d.structuralTensions || [])
          setHubCards(d)
          if (typeof d.completeness === 'number') setCompleteness(d.completeness)
          if (d.coreJudgment) setCoreJudgment(d.coreJudgment)
          if (d.supportFocus) setSupportFocus(d.supportFocus)
          if (d.currentFocus) setCurrentFocus(d.currentFocus)
        }
        if (cardRes.ok && cardRes.data) {
          setSummary(cardRes.data.summary || '')
          setLead(cardRes.data.lead || '')
          setSections(cardRes.data.sections || [])
          setFacts(cardRes.data.anchoredFacts || [])
          setRefreshedAt(cardRes.data.refreshedAt || null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [card])

  const cardMeta = useMemo(() => {
    const cards = buildHubProfileCards({
      portraitCards,
      hubCards: hubCards as never,
      structuralTensions,
      hasLocalProfile: Boolean(coreJudgment) || hasProfile(),
      completeness,
      coreJudgment,
      supportFocus,
      currentFocus,
    })
    return cards.find((c) => c.slug === card)
  }, [portraitCards, hubCards, structuralTensions, completeness, coreJudgment, supportFocus, currentFocus, card])

  const title = TITLES[card] || '画像详情'
  const progress = cardMeta?.progress ?? completeness
  const progressHint = cardMeta?.progressHint ?? ''
  const displayLead = lead && lead !== summary ? lead : summary
  const hasContent = summary || lead || sections.length > 0 || facts.length > 0

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile" surface="white">
        <div className="insight-page-wrap">
          <button type="button" className="quiet-button" onClick={() => router.push('/family-profile')}>
            <ArrowLeft size={16} /> 返回画像
          </button>
          <section className="section">
            <h2 className="section-title">{title}</h2>
            {refreshedAt ? (
              <p className="hint-text">上次整理：{new Date(refreshedAt).toLocaleString('zh-CN')}</p>
            ) : null}
            {loading ? (
              <p className="hint-text">正在加载…</p>
            ) : hasContent ? (
              <>
                <div className="detail-panel-web">
                  <p className="sheet-kicker">完整度 {progress}%</p>
                  <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>{title}</h3>
                  <div className="progress-bar" style={{ margin: '10px 0 12px' }}>
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                  {displayLead ? <p className="sheet-lead">{displayLead}</p> : null}
                  {progressHint ? <p className="hint-text">{progressHint}</p> : null}
                </div>
                {sections.map((section) => (
                  <div key={section.heading} className="sheet-block">
                    <strong>{section.heading}</strong>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {section.items.map((item) => (
                        <li key={item.slice(0, 32)} className="mini-card-body">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {facts.length > 0 ? (
                  <div className="sheet-block">
                    <strong>依据你家已记录的事实</strong>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {facts.map((f) => (
                        <li key={f.slice(0, 32)} className="mini-card-body">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="hint-text">继续交流后，这里会出现更完整的深度分析。</p>
            )}
          </section>
        </div>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

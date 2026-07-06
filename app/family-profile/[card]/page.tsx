'use client'

import { ArrowLeft } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { StructuralTensionCard } from '@/components/hifi/StructuralTensionCard'
import type { StructuralTension } from '@/types/deep-model-digest'

const TITLES: Record<string, string> = {
  growth: '动态成长画像',
  focus: '当前关注点',
  behavior: '行为模式总结',
  interaction: '家庭互动模式',
  strategies: '有效策略',
  hypotheses: '待验证假设',
  tensions: '家庭运转张力',
}

export default function ProfileCardDetailPage() {
  const router = useRouter()
  const params = useParams()
  const card = String(params.card || '')
  const [body, setBody] = useState('')
  const [facts, setFacts] = useState<string[]>([])
  const [tensions, setTensions] = useState<StructuralTension[]>([])
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/profile/card/${card}`, { credentials: 'include' })
        const json = await res.json()
        if (!cancelled && json.ok && json.data) {
          setBody(json.data.body || '')
          setFacts(json.data.anchoredFacts || [])
          setTensions(json.data.structuralTensions || [])
          setRefreshedAt(json.data.refreshedAt || null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [card])

  const title = TITLES[card] || '画像详情'

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile">
        <button type="button" className="quiet-button" onClick={() => router.push('/family-profile')}>
          <ArrowLeft size={16} /> 返回画像
        </button>
        <section className="section">
          <h2 className="section-title">{title}</h2>
          {refreshedAt ? <p className="hint-text">上次整理：{new Date(refreshedAt).toLocaleString('zh-CN')}</p> : null}
          {loading ? (
            <p className="hint-text">正在加载…</p>
          ) : body || tensions.length ? (
            card === 'tensions' && tensions.length ? (
              <StructuralTensionCard tensions={tensions} />
            ) : (
            <div className="profile-block authority-insight-card">
              <p className="authority-badge">清北学霸 · 家庭智慧</p>
              {body.split('\n').filter(Boolean).map((para) => (
                <p key={para.slice(0, 24)} className="profile-detail-para">{para}</p>
              ))}
              {facts.length > 0 ? (
                <div className="profile-fact-quotes">
                  <h3>依据你家已记录的事实</h3>
                  <ul>
                    {facts.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            )
          ) : (
            <p className="hint-text">继续交流后，这里会出现更完整的深度分析。</p>
          )}
        </section>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

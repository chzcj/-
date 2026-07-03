'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { useHydratedProfile } from '@/hooks/useHydratedProfile'
import { humanizeEntryRef, humanizeMechanismLabel } from '@/lib/entry-name-i18n'

export default function EvidencePage() {
  const router = useRouter()
  const { profile, loading } = useHydratedProfile()

  if (loading && !profile) {
    return (
      <HiFiMainShell activeTab="profile">
        <div className="loading-wrap" style={{ minHeight: '50vh' }}>
          <div className="loader" aria-hidden="true" />
        </div>
      </HiFiMainShell>
    )
  }

  if (!profile) {
    return (
      <HiFiMainShell activeTab="profile">
        <button type="button" className="quiet-button" onClick={() => router.push('/profile/result')}>
          <ArrowLeft size={16} /> 返回
        </button>
        <section className="section">
          <div className="profile-block">
            <h3>还没有画像</h3>
          </div>
        </section>
      </HiFiMainShell>
    )
  }

  const items = profile.evidence || []

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile">
        <button type="button" className="quiet-button" onClick={() => router.push('/profile/result')}>
          <ArrowLeft size={16} /> 返回
        </button>

        <article className="hero-card compact">
          <span className="module-kicker">判断依据</span>
          <h2 className="hero-title">画像从哪来</h2>
          <p className="hero-copy">下面这些信息是系统生成画像时的判断依据。每条证据都标注了来源模块和与机制链的关联。</p>
        </article>

        <section className="section">
          {items.length > 0 ? (
            items.map((e) => (
              <div key={e.id} className="profile-block">
                <h3>{humanizeMechanismLabel(e.sourceLabel)}</h3>
                <p>{humanizeEntryRef(e.evidenceText)}</p>
                {e.explanation ? <p className="hint-text">{humanizeEntryRef(e.explanation)}</p> : null}
              </div>
            ))
          ) : (
            <div className="profile-block">
              <h3>暂无证据记录</h3>
              <p className="hint-text">当前没有足够证据记录，请先完成模块建模。</p>
            </div>
          )}
        </section>

        <button type="button" className="primary-button wide-button" onClick={() => router.push('/profile/verify')}>
          看待验证观察点
          <ArrowRight size={18} />
        </button>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

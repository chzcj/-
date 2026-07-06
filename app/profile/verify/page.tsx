'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { useHydratedProfile } from '@/hooks/useHydratedProfile'

export default function VerifyPage() {
  const router = useRouter()
  const { profile, loading } = useHydratedProfile()

  if (loading) {
    return (
      <HiFiMainShell activeTab="profile">
        <div className="loading-wrap" style={{ minHeight: '40vh' }}>
          <div className="loader" aria-hidden="true" />
          <p>正在加载…</p>
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

  const points = profile.verificationPoints || []

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile">
        <button type="button" className="quiet-button" onClick={() => router.push('/profile/result')}>
          <ArrowLeft size={16} /> 返回
        </button>

        <article className="hero-card compact">
          <span className="module-kicker">待验证</span>
          <h2 className="hero-title">后面再观察什么</h2>
          <p className="hero-copy">画像已经够用了，但下面几件事再看清一点，会让后面的判断更准。</p>
        </article>

        <section className="section">
          {points.length > 0 ? (
            points.map((v) => (
              <div key={v.id} className="profile-block authority-insight-card">
                <p className="authority-badge">清北学霸 · 家庭智慧</p>
                <h3>{v.title}</h3>
                <p>{v.description}</p>
              </div>
            ))
          ) : (
            <div className="profile-block">
              <h3>暂无待验证点</h3>
              <p className="hint-text">继续交流和预演，系统会逐步补充需要观察的方向。</p>
            </div>
          )}
        </section>

        <p className="hint-text boundary-note">这些不是要你立刻改变做法，只是后面多留意。</p>

        <button type="button" className="primary-button wide-button" onClick={() => router.push('/rehearsal')}>
          进入沟通预演
          <ArrowRight size={18} />
        </button>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { useHydratedProfile } from '@/hooks/useHydratedProfile'
import { humanizeEntryRef } from '@/lib/entry-name-i18n'

export default function DeepPage() {
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
            <button type="button" className="primary-button wide-button" onClick={() => router.push('/profile/build')}>
              建立孩子画像
            </button>
          </div>
        </section>
      </HiFiMainShell>
    )
  }

  const mechanismText = humanizeEntryRef(profile.deepMechanism || '')

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile">
        <button type="button" className="quiet-button" onClick={() => router.push('/profile/result')}>
          <ArrowLeft size={16} /> 返回
        </button>

        <article className="hero-card compact">
          <span className="module-kicker">深层解释</span>
          <h2 className="hero-title">家庭机制链</h2>
          <p className="hero-copy">
            下面展示的不是普通总结，而是孩子在这个家庭里的应对链条——家长的动作触发孩子的保护策略，孩子的反应又触发家长进一步解读。
          </p>
        </article>

        <section className="section">
          {mechanismText ? (
            <div className="profile-block">
              <h3>机制链</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{mechanismText}</p>
            </div>
          ) : (
            <div className="profile-block">
              <h3>信息还不够</h3>
              <p className="hint-text">当前信息不足以构建完整机制链，建议补充更多模块信息。</p>
            </div>
          )}
        </section>

        <button type="button" className="primary-button wide-button" onClick={() => router.push('/profile/evidence')}>
          继续看判断依据
          <ArrowRight size={18} />
        </button>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

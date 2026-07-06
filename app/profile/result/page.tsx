'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { StructuralTensionCard } from '@/components/hifi/StructuralTensionCard'
import { useHydratedProfile } from '@/hooks/useHydratedProfile'
import { humanizeMechanismLabel } from '@/lib/entry-name-i18n'
import type { StructuralTension } from '@/types/deep-model-digest'

function ProfileResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justFinishedOnboarding = searchParams.get('onboarding') === '1'
  const { profile, loading } = useHydratedProfile()
  const [structuralTensions, setStructuralTensions] = useState<StructuralTension[]>([])

  useEffect(() => {
    void fetch('/api/profile/hub', { credentials: 'include' })
      .then((r) => r.json())
      .then((hub) => {
        if (hub?.ok && Array.isArray(hub.data?.structuralTensions)) {
          setStructuralTensions(hub.data.structuralTensions)
        }
      })
      .catch(() => {})
  }, [])

  const backTarget = justFinishedOnboarding ? '/profile/build' : '/family-profile'

  if (loading) {
    return (
      <HiFiMainShell activeTab="profile">
        <div className="loading-wrap" style={{ minHeight: '50vh' }}>
          <div className="loader" aria-hidden="true" />
          <h2>正在加载孩子画像…</h2>
        </div>
      </HiFiMainShell>
    )
  }

  if (!profile) {
    return (
      <HiFiMainShell activeTab="profile">
        <button type="button" className="quiet-button" onClick={() => router.push('/profile/build')}>
          <ArrowLeft size={16} /> 返回
        </button>
        <section className="section">
          <div className="profile-block">
            <h3>还没有孩子画像</h3>
            <p className="hint-text">请先完成四个模块建模</p>
            <button type="button" className="primary-button wide-button" onClick={() => router.push('/profile/build')}>
              建立孩子画像
            </button>
          </div>
        </section>
      </HiFiMainShell>
    )
  }

  const hasEvidence = (profile.evidence || []).length > 0

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile">
        {!justFinishedOnboarding ? (
          <button type="button" className="quiet-button" onClick={() => router.push(backTarget)}>
            <ArrowLeft size={16} /> 返回
          </button>
        ) : null}

        {justFinishedOnboarding ? (
          <article className="hero-card compact">
            <span className="module-kicker">画像已生成</span>
            <h2 className="hero-title">可以开始交流和预演了</h2>
            <p className="hero-copy">下面的理解会作为后续对话的背景。</p>
            <button type="button" className="primary-button wide-button" onClick={() => router.push('/daily')}>
              开始交流
              <ArrowRight size={18} />
            </button>
          </article>
        ) : (
          <article className="hero-card compact">
            <span className="module-kicker">孩子画像 · {profile.completeness}%</span>
            <h2 className="hero-title">条件化理解</h2>
            <p className="hero-copy">基于四个模块真实片段生成，会随新交流持续更新。</p>
          </article>
        )}

        <section className="section">
          <div className="profile-block">
            <h3>核心理解</h3>
            <p>{profile.coreJudgment}</p>
          </div>
        </section>

        {profile.supportFocus ? (
          <section className="section">
            <div className="profile-block">
              <h3>当前支持重点</h3>
              <p>{profile.supportFocus}</p>
            </div>
          </section>
        ) : null}

        {structuralTensions.length > 0 ? (
          <section className="section">
            <StructuralTensionCard tensions={structuralTensions} title="可能消耗孩子的运转方式" />
          </section>
        ) : null}

        {hasEvidence ? (
          <section className="section">
            <h2 className="section-title">判断依据摘要</h2>
            <div className="layer-tags">
              {Array.from(new Set(profile.evidence?.slice(0, 8).map((e) => e.sourceLabel) || []))
                .slice(0, 4)
                .map((label) => (
                  <span key={label} className="tag">
                    {humanizeMechanismLabel(label)}
                  </span>
                ))}
            </div>
          </section>
        ) : null}

        <section className="section">
          <h2 className="section-title">下一步</h2>
          <div className="profile-data-grid">
            <button type="button" className="profile-data-card" onClick={() => router.push('/profile/deep')}>
              <h3>机制链解释</h3>
              <p>家长动作与孩子保护策略如何互相强化</p>
            </button>
            <button type="button" className="profile-data-card" onClick={() => router.push('/profile/evidence')}>
              <h3>判断依据</h3>
              <p>每条证据的来源与关联说明</p>
            </button>
            <button type="button" className="profile-data-card" onClick={() => router.push('/rehearsal')}>
              <h3>沟通预演</h3>
              <p>结合画像，试一句更安全的说法</p>
            </button>
            <button type="button" className="profile-data-card" onClick={() => router.push('/daily')}>
              <h3>回到交流</h3>
              <p>带着这份理解继续聊今天的事</p>
            </button>
          </div>
        </section>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

export default function ProfileResultPage() {
  return (
    <Suspense
      fallback={
        <HiFiMainShell activeTab="profile">
          <div className="loading-wrap" style={{ minHeight: '50vh' }}>
            <div className="loader" aria-hidden="true" />
            <h2>加载中…</h2>
          </div>
        </HiFiMainShell>
      }
    >
      <ProfileResultContent />
    </Suspense>
  )
}

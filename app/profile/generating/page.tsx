'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import '../build/hifi-build.css'
import { HiFiBuildHero } from '@/components/profile/HiFiBuildHero'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { hasProfile } from '@/lib/storage/profileStorage'
import { canAccessProfileGenerating } from '@/lib/profile/buildGateState'
import {
  ensureWebProfileBuildInFlight,
  fetchServerBuildRun,
  hydrateBuiltSnapshotFromServer,
  retryServerProfileBuildRun,
} from '@/lib/profile/profileBuildRun'

const STEPS = [
  '整理四个模块的关键事实',
  '跨模块综合建模',
  '深度建模与机制复核',
  '生成条件化孩子画像',
  '整理家庭支持重点',
]

export default function GeneratingPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (hasProfile()) {
      router.replace('/profile/result?onboarding=1')
      return
    }
    if (!canAccessProfileGenerating()) {
      router.replace('/profile/build')
      return
    }

    let cancelled = false
    void (async () => {
      setError('')
      setAllowed(false)

      const builtCheck = await fetch('/api/profile/built', { credentials: 'include' })
      const builtJson = (await builtCheck.json()) as {
        ok?: boolean
        data?: { snapshot?: { coreJudgment?: string } }
      }
      if (!cancelled && builtJson.ok && builtJson.data?.snapshot?.coreJudgment?.trim()) {
        router.replace('/profile/result?onboarding=1')
        return
      }

      const existing = await fetchServerBuildRun()
      if (!cancelled && existing?.run) {
        setStep(existing.run.phase)
      }

      if (cancelled) return
      setAllowed(true)

      const result = await ensureWebProfileBuildInFlight((phase) => {
        if (!cancelled) setStep(phase)
      })

      if (cancelled) return

      if (!result.ok) {
        setError(result.message)
        return
      }

      await hydrateBuiltSnapshotFromServer()
      setStep(4)
      router.push('/profile/result?onboarding=1')
    })()

    return () => {
      cancelled = true
    }
  }, [router, retryKey])

  const handleRetry = () => {
    void retryServerProfileBuildRun().finally(() => setRetryKey((k) => k + 1))
  }

  if (!allowed && !error) {
    return (
      <HiFiBuildShell topTitle="正在生成孩子画像" stepLabel="建模中" progress={96}>
        <div className="loading-wrap">
          <div className="loader" aria-hidden="true" />
          <h2>正在进入画像生成…</h2>
        </div>
      </HiFiBuildShell>
    )
  }

  return (
    <HiFiBuildShell
      topTitle={error ? '画像没有生成成功' : '正在生成孩子画像'}
      stepLabel="建模中"
      progress={96 + Math.min(step, 4)}
      onBack={error ? () => router.push('/profile/build') : undefined}
      actions={
        error
          ? [
              { label: '重试', onClick: handleRetry },
              { label: '返回采集', variant: 'secondary', onClick: () => router.push('/profile/build') },
            ]
          : []
      }
    >
      <HiFiBuildHero
        kicker="建模中"
        title="正在综合四个模块"
        copy={
          error
            ? '可以重试一次，或返回继续补充模块信息。'
            : '画像生成会在后台继续；刷新页面后也会从服务端恢复进度。'
        }
        compact
        mascot={!error}
      />

      {!error ? (
        <section className="section">
          <div className="soft-card">
            <div className="flow-steps" aria-label="生成进度">
              {STEPS.map((label, i) => (
                <div key={label}>
                  <div className={`flow-step${i < step ? ' done' : ''}${i === step ? ' active' : ''}`}>
                    {label}
                  </div>
                  {i < STEPS.length - 1 ? <div className="flow-arrow">↓</div> : null}
                </div>
              ))}
            </div>
          </div>
          <p className="hint-text" style={{ marginTop: 12 }}>
            首版画像生成后会先展示，深层机制会继续在后台交叉验证
          </p>
        </section>
      ) : (
        <section className="section">
          <div className="soft-card">
            <p>{error}</p>
          </div>
        </section>
      )}
    </HiFiBuildShell>
  )
}

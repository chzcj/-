'use client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { listDailyObservations } from '@/lib/storage/observationStorage'

type WeeklyReport = {
  headline: string
  summary: string
  repeatedPatterns: string[]
  keyObservation: string
  nextWatchPoints: string[]
}

export default function WeeklyReportPage() {
  const router = useRouter()
  const obs = listDailyObservations(7)
  const [r, setR] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(obs.length > 0)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    const texts = obs.map(o => o.rawText).filter(Boolean)
    if (texts.length === 0) { setLoading(false); return }
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/profile/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations: texts }),
      })
      const json = await res.json()
      if (json.ok && json.data?.headline) {
        setR(json.data as WeeklyReport)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs.length])

  useEffect(() => { void load() }, [load])

  if (obs.length === 0) {
    return (
      <AppShell><div className="page without-voice">
        <PageHeader title="本周周报" showBack onBack={() => router.push('/observation')} />
        <div className="result-card card" style={{ marginTop: 20, textAlign: 'center', padding: 32 }}>
          <div className="result-title">还没有本周记录</div>
          <div style={{ fontSize: 15, color: '#6E6E73', marginTop: 10 }}>先记录几条观察，再来看周报</div>
          <button type="button" className="primary-button" onClick={() => router.push('/observation')}
            style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 20 }}>去记录今天观察</button>
        </div>
      </div></AppShell>
    )
  }

  if (loading) {
    return (
      <AppShell><div className="page without-voice">
        <PageHeader title="本周周报" showBack onBack={() => router.push('/observation')} />
        <div style={{ textAlign: 'center', padding: 60, color: '#A1A1A6', fontSize: 14 }}>正在生成本周周报…</div>
      </div></AppShell>
    )
  }

  if (error || !r) {
    return (
      <AppShell><div className="page without-voice">
        <PageHeader title="本周周报" showBack onBack={() => router.push('/observation')} />
        <div className="result-card card" style={{ marginTop: 20, textAlign: 'center', padding: 32 }}>
          <div className="result-title">这次没有生成成功</div>
          <div style={{ fontSize: 15, color: '#6E6E73', marginTop: 10 }}>可以稍后再试一次。</div>
          <button type="button" className="primary-button" onClick={() => void load()}
            style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 20 }}>重试</button>
        </div>
      </div></AppShell>
    )
  }

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="本周周报" showBack onBack={() => router.push('/observation')} />

        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>本周整理</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 12, lineHeight: 1.4 }}>{r.headline}</div>
        <div style={{ fontSize: 15, lineHeight: 1.62, color: '#6E6E73', marginBottom: 20 }}>{r.summary}</div>

        {r.repeatedPatterns.length > 0 ? (
          <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 14, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>这一周反复出现</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {r.repeatedPatterns.map((p) => <span key={p} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{p}</span>)}
            </div>
          </div>
        ) : null}

        {r.keyObservation ? (
          <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 14, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>这一周最值得注意</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F' }}>{r.keyObservation}</div>
          </div>
        ) : null}

        {r.nextWatchPoints.length > 0 ? (
          <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 20, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>下周继续留意</div>
            {r.nextWatchPoints.map((p, i) => (
              <div key={i} style={{ fontSize: 15, color: '#1D1D1F', padding: '5px 0', borderTop: i > 0 ? '1px solid rgba(110,106,248,0.06)' : 'none' }}>{p}</div>
            ))}
          </div>
        ) : null}

        <div style={{ fontSize: 13, color: '#A1A1A6', textAlign: 'center', marginBottom: 14 }}>共 {obs.length} 条本周观察记录</div>

        <button type="button" className="secondary-button"
          onClick={() => router.push('/observation')}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}>
          继续记录下周观察
        </button>

        <BottomNavTabs active="record" />
      </div>
    </AppShell>
  )
}

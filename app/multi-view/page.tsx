'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'

type MultiView = {
  headline: string
  summary: string
  parentView: string
  childView: string
  teacherView: string
  finalChips: string[]
}

export default function MultiViewPage() {
  const router = useRouter()
  const [m, setM] = useState<MultiView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    let childText = ''
    try { childText = sessionStorage.getItem('childos_child_voice') || '' } catch {}
    try {
      const res = await fetch('/api/multi-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childText }),
      })
      const json = await res.json()
      if (json.ok && json.data) setM(json.data as MultiView)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="多视角校正" showBack onBack={() => router.push('/profile/result')} />

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#A1A1A6', fontSize: 14 }}>正在把家长、孩子、老师三方放一起看…</div>
        ) : error || !m ? (
          <div className="card" style={{ padding: 20, borderRadius: 22, marginTop: 10, textAlign: 'center', background: 'rgba(157,204,117,0.04)', border: '1px solid rgba(157,204,117,0.10)' }}>
            <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14 }}>这一步没整理成功，可以再试一次。</div>
            <button type="button" className="secondary-button" onClick={() => void load()} style={{ borderRadius: 999, height: 44, padding: '0 24px', fontSize: 14, fontWeight: 600 }}>重试</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6f9f56', marginBottom: 6 }}>综合整理</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 12, lineHeight: 1.4 }}>{m.headline}</div>
            <div style={{ fontSize: 15, lineHeight: 1.62, color: '#6E6E73', marginBottom: 20 }}>{m.summary}</div>

            <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 10, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6f9f56', marginBottom: 6 }}>家长这边</div>
              <div style={{ fontSize: 15, color: '#1D1D1F', lineHeight: 1.6 }}>{m.parentView}</div>
            </div>

            <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 10, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6f9f56', marginBottom: 6 }}>孩子自己说</div>
              <div style={{ fontSize: 15, color: '#1D1D1F', lineHeight: 1.6 }}>{m.childView}</div>
            </div>

            <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 14, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6f9f56', marginBottom: 6 }}>老师观察</div>
              <div style={{ fontSize: 15, color: '#1D1D1F', lineHeight: 1.6 }}>{m.teacherView}</div>
            </div>

            {m.finalChips.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {m.finalChips.map((c) => <span key={c} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{c}</span>)}
              </div>
            ) : null}

            <button type="button" className="primary-button"
              onClick={() => router.push('/profile/result')}
              style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}>
              回到孩子档案
            </button>
          </>
        )}

        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}

'use client'
import { RefreshCw } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { mockRehearsalResult } from '@/data/mockOutputs'

function RehearsalResultInner() {
  const router = useRouter()
  const params = useSearchParams()
  const parentText = params.get('text') || '(未输入内容)'
  const [r, setR] = useState(mockRehearsalResult)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/rehearsal/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentText: params.get('text') || '' }),
        })
        const json = await res.json()
        if (!cancelled && json.ok && json.data?.headline) setR(json.data)
      } catch {} finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [params])

  return (
    <div className="page without-voice with-bottom-tabs">
      <PageHeader title="沟通预演" showBack onBack={() => router.push('/rehearsal')} />

      <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#A1A1A6', marginBottom: 4 }}>你原本想说</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: '#1D1D1F', whiteSpace: 'pre-wrap' }}>{parentText}</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#A1A1A6', fontSize: 14 }}>正在分析沟通方式…</div>
      ) : (
        <div className="card" style={{ padding: 22, borderRadius: 28, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 10, lineHeight: 1.4 }}>{r.headline}</div>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: '#6E6E73', marginBottom: 18 }}>{r.explanation}</div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>孩子可能先听成</div>
            {r.childMayHear.map((h, i) => (
              <div key={i} style={{ fontSize: 15, color: '#1D1D1F', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(29,29,31,0.04)' : 'none' }}>{h}</div>
            ))}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>更容易卡住的地方</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#6E6E73' }}>{r.stuckPoint}</div>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(110,106,248,0.05)', border: '1px solid rgba(110,106,248,0.10)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>更建议这样开口</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F' }}>{r.suggestedWording}</div>
          </div>
        </div>
      )}

      <button type="button" className="secondary-button"
        onClick={() => router.push('/rehearsal')}
        style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}>
        <RefreshCw size={18} style={{ marginRight: 6 }} />换一种说法继续预演
      </button>

      <BottomNavTabs active="rehearsal" />
    </div>
  )
}

export default function RehearsalResultPage() {
  return (<AppShell><Suspense><RehearsalResultInner /></Suspense></AppShell>)
}

'use client'
import { RefreshCw } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { mockConflictReview } from '@/data/mockOutputs'

function ConflictResultInner() {
  const router = useRouter()
  const params = useSearchParams()
  const rawText = params.get('text') || ''
  const [r, setR] = useState<typeof mockConflictReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/rehearsal/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentText: rawText, mode: 'conflict' }),
        })
        const json = await res.json()
        if (cancelled) return
        if (json.ok && json.data?.headline) setR(json.data)
        else setError(true)
      } catch { if (!cancelled) setError(true) } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [rawText])

  return (
    <div className="page without-voice with-bottom-tabs">
      <PageHeader title="冲突复盘" showBack onBack={() => router.push('/conflict')} />

      {rawText ? (
        <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)', marginBottom: 16, whiteSpace: 'pre-wrap', fontSize: 13, color: '#A1A1A6', lineHeight: 1.6 }}>{rawText}</div>
      ) : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#A1A1A6', fontSize: 14 }}>正在复盘冲突…</div>
      ) : error || !r ? (
        <div className="card" style={{ padding: 22, borderRadius: 28, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#6E6E73', marginBottom: 14 }}>这次复盘没有成功，可以稍后再试一次。</div>
          <button type="button" className="secondary-button" onClick={() => router.push('/conflict')}
            style={{ borderRadius: 999, height: 44, padding: '0 24px', fontSize: 14, fontWeight: 600 }}>重新复盘</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 22, borderRadius: 28, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 10, lineHeight: 1.4 }}>{r.headline}</div>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: '#6E6E73', marginBottom: 18 }}>{r.explanation}</div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>最容易让冲突升级的句子</div>
            <div style={{ fontSize: 15, fontWeight: 650, color: '#1D1D1F', padding: '10px 14px', borderRadius: 16, background: 'rgba(110,106,248,0.06)' }}>&quot;{r.escalationSentence}&quot;</div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>孩子当时更可能听成</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#6E6E73' }}>{r.childMayHear}</div>
          </div>
          <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(110,106,248,0.05)', border: '1px solid rgba(110,106,248,0.10)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>更稳的替换说法</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F' }}>{r.suggestedReplacement}</div>
          </div>
        </div>
      )}

      <button type="button" className="secondary-button" onClick={() => router.push('/conflict')}
        style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}>
        <RefreshCw size={18} style={{ marginRight: 6 }} />复盘下一次冲突
      </button>
      <BottomNavTabs active="rehearsal" />
    </div>
  )
}

export default function ConflictResultPage() {
  return (<AppShell><Suspense><ConflictResultInner /></Suspense></AppShell>)
}

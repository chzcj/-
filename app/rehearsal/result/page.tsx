'use client'
import { RefreshCw } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { mockRehearsalResult } from '@/data/mockOutputs'

type ProfileAware = {
  childLikelyHearing: string
  likelyTriggeredMechanisms: string[]
  possibleChildReaction: { immediateReaction: string; innerReaction: string; behaviorRisk: string }
  riskPoints: string[]
  saferVersion: string
  whyThisIsSafer: string
  avoidPhrases: string[]
  usedProfileEvidence: string[]
}

function RehearsalResultInner() {
  const router = useRouter()
  const params = useSearchParams()
  const parentText = params.get('text') || '(未输入内容)'
  const [r, setR] = useState<typeof mockRehearsalResult | null>(null)
  const [pa, setPa] = useState<ProfileAware | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/rehearsal/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentText: params.get('text') || '',
            // 把家长采集的预演上下文一起发；后端据此 + 服务端记忆做画像感知预演（交付文档 5.2）。
            rehearsalContext: {
              parentGoal: params.get('goal') || '',
              parentWorry: params.get('worry') || '',
              whatHappenedBeforeTalk: params.get('bg') || '',
            },
          }),
        })
        const json = await res.json()
        if (cancelled) return
        if (json.ok && json.data?.profileAware) setPa(json.data as ProfileAware)
        else if (json.ok && json.data?.headline) setR(json.data)
        else setError(true)
      } catch { if (!cancelled) setError(true) } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [params])

  return (
    <div className="page without-voice with-bottom-tabs">
      <PageHeader title="沟通预演" showBack onBack={() => router.push('/rehearsal')} />

      <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(111,159,86,0.06)', border: '1px solid rgba(111,159,86,0.14)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#A1A1A6', marginBottom: 4 }}>你原本想说</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: '#1D1D1F', whiteSpace: 'pre-wrap' }}>{parentText}</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#A1A1A6', fontSize: 14 }}>正在结合孩子画像分析沟通方式…</div>
      ) : pa ? (
        <div className="card" style={{ padding: 22, borderRadius: 28, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)', marginBottom: 16 }}>
          <Section title="孩子可能先听成">{pa.childLikelyHearing}</Section>
          {pa.possibleChildReaction ? (
            <Section title="他可能的反应">
              {`当下：${pa.possibleChildReaction.immediateReaction}\n心里：${pa.possibleChildReaction.innerReaction}\n行为风险：${pa.possibleChildReaction.behaviorRisk}`}
            </Section>
          ) : null}
          {pa.riskPoints?.length ? <ListSection title="容易踩的点" items={pa.riskPoints} /> : null}
          <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(111,159,86,0.08)', border: '1px solid rgba(111,159,86,0.14)', marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', marginBottom: 8 }}>更建议这样开口</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F' }}>{pa.saferVersion}</div>
            {pa.whyThisIsSafer ? <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', marginTop: 8 }}>{pa.whyThisIsSafer}</div> : null}
          </div>
          {pa.avoidPhrases?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {pa.avoidPhrases.map((p, i) => <span key={i} className="chip" style={{ fontSize: 12, color: '#C0392B', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.12)' }}>避免：{p}</span>)}
            </div>
          ) : null}
        </div>
      ) : r ? (
        <div className="card" style={{ padding: 22, borderRadius: 28, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 10, lineHeight: 1.4 }}>{r.headline}</div>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 18 }}>{r.explanation}</div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', marginBottom: 8 }}>孩子可能先听成</div>
            {r.childMayHear.map((h, i) => (
              <div key={i} style={{ fontSize: 15, color: '#1D1D1F', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(29,29,31,0.04)' : 'none' }}>{h}</div>
            ))}
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', marginBottom: 6 }}>更容易卡住的地方</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{r.stuckPoint}</div>
          </div>
          <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(111,159,86,0.08)', border: '1px solid rgba(111,159,86,0.14)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', marginBottom: 8 }}>更建议这样开口</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F' }}>{r.suggestedWording}</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 22, borderRadius: 28, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 14 }}>这次预演没有成功，可以换一种说法再试一次。</div>
          <button type="button" className="secondary-button" onClick={() => router.push('/rehearsal')}
            style={{ borderRadius: 999, height: 44, padding: '0 24px', fontSize: 14, fontWeight: 600 }}>重新预演</button>
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

function Section({ title, children }: { title: string; children: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', whiteSpace: 'pre-wrap' }}>{children}</div>
    </div>
  )
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', marginBottom: 6 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: '#1D1D1F' }}>{it}</li>)}
      </ul>
    </div>
  )
}

export default function RehearsalResultPage() {
  return (<AppShell><Suspense><RehearsalResultInner /></Suspense></AppShell>)
}

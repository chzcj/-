'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'

type BoardSnapshot = {
  childCurrentState: string
  stableUnderstanding: string[]
  familyInteractionPatterns: string[]
  recentChanges: string[]
  pendingQuestions: string[]
  currentBestNextStep: string
}

export default function BoardPage() {
  const router = useRouter()
  const [board, setBoard] = useState<BoardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/board')
      .then((r) => r.json())
      .then((json) => { if (alive && json.ok) setBoard(json.data) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <AppShell>
      <div className="page">
        <PageHeader title="家庭支持看板" showBack onBack={() => router.push('/home')} />

        {loading ? (
          <div style={{ fontSize: 14, color: '#6E6E73', padding: '24px 0' }}>正在整理看板…</div>
        ) : board ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Section title="当前状态" accent>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', margin: 0 }}>{board.childCurrentState}</p>
            </Section>
            <ListSection title="稳定理解" items={board.stableUnderstanding} empty="还在积累证据，暂不下稳定结论。" />
            <ListSection title="家庭互动模式" items={board.familyInteractionPatterns} empty="还没看到反复出现的互动模式。" />
            <ListSection title="近期变化" items={board.recentChanges} empty="近期暂无明显变化。" />
            <ListSection title="待验证关键点" items={board.pendingQuestions} empty="暂无待验证的点。" />
            <Section title="下一步" accent>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', margin: 0 }}>{board.currentBestNextStep}</p>
            </Section>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#6E6E73', padding: '24px 0' }}>看板暂时没有加载出来，可以稍后再看。</div>
        )}
      </div>
    </AppShell>
  )
}

function Section({ title, children, accent }: { title: string; children: ReactNode; accent?: boolean }) {
  return (
    <div
      className="card"
      style={{ padding: 16, borderRadius: 18, background: accent ? 'rgba(110,106,248,0.04)' : '#fff', border: `1px solid ${accent ? 'rgba(110,106,248,0.10)' : 'rgba(0,0,0,0.05)'}` }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function ListSection({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <Section title={title}>
      {items.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it, i) => (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.6, color: '#1D1D1F' }}>{it}</li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 13, color: '#9A9AA0', margin: 0 }}>{empty}</p>
      )}
    </Section>
  )
}

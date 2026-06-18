'use client'
import { Archive, CalendarRange } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'

type EvidenceRef = { kind?: string; id?: string; at?: string; snippet?: string }
type BoardSnapshot = {
  childCurrentState: string
  stableUnderstanding: string[]
  familyInteractionPatterns: string[]
  recentChanges: string[]
  judgmentChanges?: string[]
  pendingQuestions: string[]
  currentBestNextStep: string
  pending?: boolean
  updatedAt?: string
  evidenceRefs?: EvidenceRef[]
}

export default function BoardPage() {
  const router = useRouter()
  const [board, setBoard] = useState<BoardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    let tries = 0
    const MAX_TRIES = 5 // 刚建模后 digest_update 需几秒写好快照，期间轮询重试，避免空态
    async function load() {
      try {
        const r = await fetch('/api/board')
        const json = await r.json()
        if (!alive) return
        if (json.ok && json.data) {
          const d = json.data as BoardSnapshot
          const thin = d.stableUnderstanding.length === 0 && d.familyInteractionPatterns.length === 0 && d.recentChanges.length === 0
          if (d.pending && thin && tries < MAX_TRIES) {
            tries += 1
            setTimeout(() => { if (alive) void load() }, 2500) // 等后台 digest 写好快照再读
            return // 保持 loading 态
          }
          setBoard(d)
        }
        setLoading(false)
      } catch {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [])

  const updatedLabel = board?.updatedAt
    ? new Date(board.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <AppShell>
      <div className="page">
        <PageHeader title="家庭支持看板" showBack onBack={() => router.push('/home')} />

        {loading ? (
          <div style={{ fontSize: 14, color: '#6E6E73', padding: '24px 0' }}>正在整理看板…（刚建模时可能需要几秒）</div>
        ) : board ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Section title="当前状态" accent>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', margin: 0 }}>{board.childCurrentState}</p>
            </Section>
            <ListSection title="稳定理解" items={board.stableUnderstanding} empty="还在积累证据，暂不下稳定结论。" />
            <ListSection title="家庭互动模式" items={board.familyInteractionPatterns} empty="还没看到反复出现的互动模式。" />
            <ListSection title="近期变化" items={board.recentChanges} empty="近期暂无明显变化。" />
            <ListSection title="判断变化" items={board.judgmentChanges || []} empty="我们对孩子的理解暂时没有需要调整的地方。" />
            <ListSection title="待验证关键点" items={board.pendingQuestions} empty="暂无待验证的点。" />
            <Section title="下一步" accent>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', margin: 0 }}>{board.currentBestNextStep}</p>
            </Section>

            {/* 看板二级入口：家庭规划（下一步行动）+ 完整档案 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => router.push('/family-planner')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, background: 'rgba(110,106,248,0.06)', border: '1px solid rgba(110,106,248,0.14)', borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#6E6AF8', cursor: 'pointer' }}>
                <CalendarRange size={16} />制定家庭规划
              </button>
              <button type="button" onClick={() => router.push('/family-profile')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#1D1D1F', cursor: 'pointer' }}>
                <Archive size={16} />查看完整档案
              </button>
            </div>

            {board.evidenceRefs && board.evidenceRefs.length > 0 ? (
              <details style={{ marginTop: 2 }}>
                <summary style={{ fontSize: 12, color: '#6E6AF8', cursor: 'pointer', listStyle: 'none' }}>这些判断的依据（{board.evidenceRefs.length}）</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {board.evidenceRefs.filter(e => e.snippet).slice(0, 8).map((e, i) => (
                    <div key={i} style={{ fontSize: 12, lineHeight: 1.5, color: '#6E6E73', background: 'rgba(110,106,248,0.04)', borderLeft: '2px solid rgba(110,106,248,0.3)', borderRadius: 6, padding: '6px 10px' }}>{e.snippet}</div>
                  ))}
                </div>
              </details>
            ) : null}
            {updatedLabel ? (
              <div style={{ fontSize: 12, color: '#A1A1A6', textAlign: 'center', marginTop: 2 }}>看板已于 {updatedLabel} 更新</div>
            ) : null}
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

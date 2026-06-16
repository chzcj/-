'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar'
import { mockDailyObservationInsight } from '@/data/mockOutputs'
import { createDailyObservation, getObservationCount } from '@/lib/storage/observationStorage'
import type { InputMode } from '@/types/childos'

export default function ObservationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [insight, setInsight] = useState<typeof mockDailyObservationInsight | null>(null)

  async function handleSubmit(text: string, _mode: InputMode) {
    if (!text.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      const json = await res.json()
      const aiInsight = json.ok && json.data?.visibleReply
        ? json.data.visibleReply
        : ''
      const insightText = aiInsight || mockDailyObservationInsight.insight

      createDailyObservation({
        rawText: text.trim(),
        insight: insightText,
        linkedAreas: aiInsight ? (json.data?.linkedAreas || []) : mockDailyObservationInsight.linkedAreas,
        note: mockDailyObservationInsight.note,
      })
      setInsight({ ...mockDailyObservationInsight, insight: insightText })
      setSaved(true)
    } catch {} finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="page with-raised-voice">



        <PageHeader title="每日观察" showBack onBack={() => router.push('/home')} />
        <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>
          今天孩子有哪一个小片段，值得记一下
        </div>
        <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14 }}>一句话、一个表情变化都可以</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {['放学后', '说到学习时', '开始前反应'].map((c) => <span key={c} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{c}</span>)}
        </div>

        {saved && insight ? (
          <div className="card" style={{ padding: 18, borderRadius: 22, marginTop: 16, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>系统解读</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F', marginBottom: 10 }}>{insight.insight}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {insight.linkedAreas.map((a) => <span key={a} className="chip" style={{ fontSize: 11, background: 'rgba(110,106,248,0.06)', color: '#6E6AF8', border: '1px solid rgba(110,106,248,0.12)' }}>{a}</span>)}
            </div>
          </div>
        ) : null}

        <BottomNavTabs active="record" />
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint="今天孩子有哪一个小片段，值得记一下" disabled={loading} elevated onSubmit={handleSubmit} />
    </AppShell>
  )
}

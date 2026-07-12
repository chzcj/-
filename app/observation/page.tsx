'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar'
import { readDailyStream } from '@/lib/daily/dailyStreamClient'
import { createDailyObservation } from '@/lib/storage/observationStorage'
import type { InputMode } from '@/types/childos'

export default function ObservationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [insight, setInsight] = useState<{ insight: string; linkedAreas: string[]; note: string } | null>(null)
  const [error, setError] = useState('')

  async function handleSubmit(text: string, _mode: InputMode) {
    if (!text.trim() || loading) return
    setLoading(true)
    setStreaming('')
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/daily/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })

      const { acc, finalLinked, streamError, httpError } = await readDailyStream(res, setStreaming)
      const insightText = acc.trim()

      if (httpError || streamError) {
        setError(httpError || streamError || '解读暂时没成功，可以再试一次。')
        return
      }

      // 没有 AI 解读（空流 / 后端降级）：不编造、不回退 mock，提示重试。
      if (!insightText) {
        setError('这次没有解读出来，可以再说一次。')
        return
      }

      createDailyObservation({
        rawText: text.trim(),
        insight: insightText,
        linkedAreas: finalLinked || [],
        note: '',
      })
      setInsight({ insight: insightText, linkedAreas: finalLinked || [], note: '' })
      setSaved(true)
    } catch {
      setError('解读暂时没成功，可以再试一次。')
    } finally {
      setLoading(false)
      setStreaming('')
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

        {loading && streaming ? (
          <div className="card" style={{ padding: 18, borderRadius: 22, marginTop: 16, background: 'rgba(157,204,117,0.04)', border: '1px solid rgba(157,204,117,0.10)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6f9f56', marginBottom: 8 }}>系统解读中…</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F' }}>{streaming}</div>
          </div>
        ) : null}

        {saved && insight ? (
          <div className="card" style={{ padding: 18, borderRadius: 22, marginTop: 16, background: 'rgba(157,204,117,0.04)', border: '1px solid rgba(157,204,117,0.10)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6f9f56', marginBottom: 8 }}>系统解读</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F', marginBottom: 10 }}>{insight.insight}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {insight.linkedAreas.map((a) => <span key={a} className="chip" style={{ fontSize: 11, background: 'rgba(157,204,117,0.06)', color: '#6f9f56', border: '1px solid rgba(157,204,117,0.12)' }}>{a}</span>)}
            </div>
          </div>
        ) : null}

        {error ? <div className="toast">{error}</div> : null}

        <BottomNavTabs active="record" />
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint="按住说话，或点键盘输入" disabled={loading} elevated onSubmit={handleSubmit} />
    </AppShell>
  )
}

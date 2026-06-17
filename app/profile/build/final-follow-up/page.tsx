'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { FollowUpCard } from '@/components/ai/FollowUpCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { createFollowUpRecord } from '@/lib/storage/entryStorage'
import { getStorage } from '@/lib/storage/localStorageService'

type FinalQuestion = { purpose: string; directions: string[]; voicePrompt: string }

export default function FinalFollowUpPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fu, setFu] = useState<FinalQuestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      // 聚合五入口阶段总结作为综合追问的输入（真数据驱动，不再用 mock）。
      const summaries = (getStorage().stageSummaries || []).map(s => `[${s.entryType}] ${s.mainJudgment}`).filter(Boolean)
      const rawText = summaries.join('\n') || '家长已完成五个入口的初步描述，请给一个最关键的综合追问。'
      const res = await fetch('/api/entry/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryType: 'final', rawText }),
      })
      const json = await res.json()
      if (json.ok && json.data?.purpose) {
        setFu({ purpose: json.data.purpose, directions: json.data.directions || [], voicePrompt: json.data.voicePrompt || '' })
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function handleSubmit() {
    if (!text.trim() || submitting) return
    setSubmitting(true)
    // 持久化综合补充答案（entryType='final'），generating 会把它作为 crossCuttingSupplement 纳入综合。
    createFollowUpRecord({
      entryType: 'final',
      purpose: fu?.purpose || '五入口综合补充',
      directions: fu?.directions || [],
      voicePrompt: fu?.voicePrompt || '',
      userAnswer: text.trim(),
    })
    router.push('/profile/generating')
  }

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="综合补充" showBack onBack={() => router.push('/profile/build')} />
        <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6, marginTop: 4 }}>
          五部分已经基本够了，我还想再补一个关键点
        </div>
        <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 16 }}>这一步很关键，能帮系统把主判断收得更准</div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#A1A1A6', fontSize: 14 }}>正在结合你刚才讲的五个入口，整理一个最关键的追问…</div>
        ) : error ? (
          <div className="card" style={{ padding: 20, borderRadius: 22, marginBottom: 14, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14 }}>这一步没有整理成功，可以再试一次。</div>
            <button type="button" className="secondary-button" onClick={() => void load()} style={{ borderRadius: 999, height: 44, padding: '0 24px', fontSize: 14, fontWeight: 600 }}>重试</button>
          </div>
        ) : fu ? (
          <FollowUpCard purpose={fu.purpose} directions={fu.directions} voicePrompt={fu.voicePrompt} />
        ) : null}

        {!loading && !error ? (
          <>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="把刚才想到的场景写在这里..."
              style={{ width: '100%', minHeight: 100, borderRadius: 20, border: '1px solid rgba(29,29,31,0.08)', background: 'rgba(255,255,255,0.72)', padding: 14, fontSize: 15, lineHeight: 1.55, color: '#1D1D1F', resize: 'vertical', outline: 'none', fontFamily: 'inherit', marginTop: 14 }} />
            <button type="button" className="primary-button" onClick={handleSubmit} disabled={!text.trim() || submitting}
              style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 14 }}>{submitting ? '正在进入建模…' : '继续补充'}</button>
          </>
        ) : null}
        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}

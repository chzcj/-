'use client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { FollowUpCard } from '@/components/ai/FollowUpCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { createFollowUpRecord, getLatestEntryRecord } from '@/lib/storage/entryStorage'

const ET = 'environment'
const TITLE = '关系环境'
const STEP = '5/5'

type FollowUpData = { purpose: string; directions: string[]; voicePrompt: string }

export default function FollowUpPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [followUp, setFollowUp] = useState<FollowUpData | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setAiLoading(true)
    setError(false)
    const latest = getLatestEntryRecord(ET)
    if (!latest?.rawText) { setError(true); setAiLoading(false); return }
    try {
      const res = await fetch('/api/entry/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryType: ET, rawText: latest.rawText }) })
      const json = await res.json()
      if (json.ok && json.data?.purpose) {
        setFollowUp({ purpose: json.data.purpose, directions: json.data.directions || [], voicePrompt: json.data.voicePrompt || '' })
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setAiLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function handleSubmit() {
    if (!text.trim() || loading) return
    setLoading(true)
    createFollowUpRecord({ entryType: ET, purpose: followUp?.purpose || '', directions: followUp?.directions || [], voicePrompt: followUp?.voicePrompt || '', userAnswer: text.trim() })
    setLoading(false)
    router.push(`/profile/build/${ET}/summary`)
  }

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title={`${TITLE} ${STEP}`} showBack onBack={() => router.push(`/profile/build/${ET}`)} />
        {aiLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#A1A1A6', fontSize: 14 }}>正在分析你的输入…</div>
        ) : error || !followUp ? (
          <div className="card" style={{ padding: 20, borderRadius: 22, textAlign: 'center', background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
            <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14 }}>没生成追问，可以直接写补充，或重试。</div>
            <button type="button" className="secondary-button" onClick={() => void load()} style={{ borderRadius: 999, height: 44, padding: '0 24px', fontSize: 14, fontWeight: 600 }}>重试</button>
          </div>
        ) : (
          <FollowUpCard purpose={followUp.purpose} directions={followUp.directions} voicePrompt={followUp.voicePrompt} />
        )}
        <textarea className="text-field" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="把刚才想到的补充写在这里..." style={{ width: '100%', minHeight: 100, borderRadius: 20, border: '1px solid rgba(29,29,31,0.08)', background: 'rgba(255,255,255,0.72)', padding: 14, fontSize: 15, lineHeight: 1.55, color: '#1D1D1F', resize: 'vertical', outline: 'none', fontFamily: 'inherit', marginTop: 14 }} />
        <button type="button" className="primary-button" onClick={handleSubmit} disabled={!text.trim() || loading}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 14 }}>继续补充</button>
        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}

'use client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { StageSummaryCard } from '@/components/ai/StageSummaryCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { getLatestEntryRecord, markEntryCompleted } from '@/lib/storage/entryStorage'

const ET = 'study'
const TITLE = '学习与作业'
const NEXT_BTN = '继续填日常节奏'

type SummaryData = { mainJudgment: string; facts: string[]; note: string }

export default function SummaryPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setAiLoading(true)
    setError(false)
    const records = getLatestEntryRecord(ET)
    if (!records?.rawText) { setError(true); setAiLoading(false); return }
    try {
      const res = await fetch('/api/entry/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryType: ET, rawText: records.rawText, stage: 'summary' }) })
      const json = await res.json()
      if (json.ok && json.data?.mainJudgment) {
        setSummary({ mainJudgment: json.data.mainJudgment, facts: json.data.facts || [], note: json.data.note || '' })
        fetch('/api/memory/write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawMaterials: [records.rawText], newInput: `[${ET}] 阶段总结：${json.data.mainJudgment}`, cleanedFacts: json.data.facts || [] }) }).catch(() => {})
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

  function handleNext() {
    markEntryCompleted(ET)
    router.push('/profile/build')
  }

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title={`${TITLE} 阶段整理`} showBack onBack={() => router.push('/profile/build')} />
        {aiLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#A1A1A6', fontSize: 14 }}>正在整理阶段总结…</div>
        ) : error || !summary ? (
          <div className="card" style={{ padding: 20, borderRadius: 22, textAlign: 'center', background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
            <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14 }}>这一步没整理成功，可以再试一次。</div>
            <button type="button" className="secondary-button" onClick={() => void load()} style={{ borderRadius: 999, height: 44, padding: '0 24px', fontSize: 14, fontWeight: 600 }}>重试</button>
          </div>
        ) : (
          <StageSummaryCard mainJudgment={summary.mainJudgment} facts={summary.facts} note={summary.note} />
        )}
        <button type="button" className="primary-button" onClick={handleNext} disabled={aiLoading}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 14 }}>{NEXT_BTN}</button>
        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}

'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { StageSummaryCard } from '@/components/ai/StageSummaryCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { getMockStageSummary } from '@/data/mockOutputs'
import { getLatestEntryRecord, markEntryCompleted } from '@/lib/storage/entryStorage'

const ET = 'emotion'
const TITLE = '情绪压力'
const NEXT_BTN = '继续填关系环境'

export default function SummaryPage() {
  const router = useRouter()
  const [summary, setSummary] = useState(getMockStageSummary(ET))
  const [aiLoading, setAiLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const records = getLatestEntryRecord(ET)
      if (!records?.rawText) { setAiLoading(false); return }
      try {
        const res = await fetch('/api/entry/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryType: ET, rawText: records.rawText, stage: 'summary' }) })
        const json = await res.json()
        if (!cancelled && json.ok && json.data?.mainJudgment) {
          setSummary({ entryType: ET, mainJudgment: json.data.mainJudgment, facts: json.data.facts || [], pendingHypotheses: json.data.pendingHypotheses || [], note: json.data.note || ''})
          fetch('/api/memory/write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawMaterials: [records.rawText], newInput: `[${ET}] 阶段总结：${json.data.mainJudgment}`, cleanedFacts: json.data.facts || [] }) }).catch(() => {})
        }
      } catch {} finally { if (!cancelled) setAiLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function handleNext() {
    markEntryCompleted(ET)
    router.push('/profile/build')
  }

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title={`${TITLE} 阶段整理`} showBack onBack={() => router.push('/profile/build')} />
        {aiLoading ? <div style={{ padding: 20, textAlign: 'center', color: '#A1A1A6', fontSize: 14 }}>正在整理阶段总结…</div>
        : <StageSummaryCard mainJudgment={summary.mainJudgment} facts={summary.facts} note={summary.note} />}
        <button type="button" className="primary-button" onClick={handleNext}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 14 }}>{NEXT_BTN}</button>
        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}

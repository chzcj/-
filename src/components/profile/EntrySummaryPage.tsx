'use client'

import { Check, Edit3, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiFiBuildHero } from '@/components/profile/HiFiBuildHero'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { getEntryConfig } from '@/data/entryConfig'
import {
  buildEntryPath,
  getEntryProgressPercent,
  getNextBuildEntry,
  type BuildEntryType,
} from '@/lib/profile/buildEntries'
import { persistEntryStageSummary } from '@/lib/profile/persistStageSummary'
import { requestEntrySummary } from '@/lib/profile/entryAnalyze'
import { getLatestEntryRecord, getLatestStageSummary, getCombinedEntryText, markEntryCompleted } from '@/lib/storage/entryStorage'
import { pushBuildStateToServer } from '@/lib/profile/profileSync'

type SummaryData = {
  mainJudgment: string
  facts: string[]
  pendingHypotheses: string[]
  note: string
}

export function EntrySummaryPage({ entryType }: { entryType: BuildEntryType }) {
  const router = useRouter()
  const config = getEntryConfig(entryType)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const load = useCallback(async () => {
    setAiLoading(true)
    setError(false)
    setErrorMessage('')

    const cached = getLatestStageSummary(entryType)
    if (cached?.mainJudgment) {
      setSummary({
        mainJudgment: cached.mainJudgment,
        facts: cached.facts || [],
        pendingHypotheses: cached.pendingHypotheses || [],
        note: cached.note || '',
      })
      setAiLoading(false)
      return
    }

    const records = getLatestEntryRecord(entryType)
    const combinedText = getCombinedEntryText(entryType)
    if (!records?.rawText || !combinedText) {
      setError(true)
      setErrorMessage('还没有可整理的内容，请先返回填写。')
      setAiLoading(false)
      return
    }

    const result = await requestEntrySummary(entryType, combinedText)
    if (!result.ok) {
      setError(true)
      setErrorMessage(result.error.message || '这一步暂时没有整理成功，可以稍后再试。')
      setAiLoading(false)
      return
    }

    const data = {
      mainJudgment: result.data.mainJudgment,
      facts: result.data.facts || [],
      pendingHypotheses: result.data.pendingHypotheses || [],
      note: result.data.note || '',
    }
    persistEntryStageSummary(entryType, data)
    setSummary(data)
    fetch('/api/memory/write', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawMaterials: [combinedText],
        newInput: `[${entryType}] 阶段总结：${data.mainJudgment}`,
        cleanedFacts: data.facts,
      }),
    }).catch(() => {})
    setAiLoading(false)
  }, [entryType])

  useEffect(() => {
    void load()
  }, [load])

  function handleConfirm() {
    markEntryCompleted(entryType)
    pushBuildStateToServer()
    const next = getNextBuildEntry(entryType)
    if (next === 'final-follow-up') {
      router.push('/profile/build/final-follow-up')
      return
    }
    if (next) {
      router.push(buildEntryPath(next))
      return
    }
    router.push('/profile/build')
  }

  const isLast = getNextBuildEntry(entryType) === 'final-follow-up'

  return (
    <HiFiBuildShell
      topTitle={config.summaryTitle}
      stepLabel={`${config.stepLabel} 已整理`}
      progress={getEntryProgressPercent(entryType, 'summary')}
      onBack={() => router.push('/profile/build')}
      actions={
        aiLoading || !summary
          ? []
          : [
              {
                label: isLast ? '整理得对，进入收尾追问' : '整理得对，继续下一项',
                icon: <Check size={18} />,
                onClick: handleConfirm,
              },
              {
                label: '我想改一下',
                variant: 'secondary',
                icon: <Edit3 size={18} />,
                onClick: () => router.push(buildEntryPath(entryType)),
              },
              {
                label: '我再补一段',
                variant: 'quiet',
                icon: <Plus size={18} />,
                onClick: () => router.push(buildEntryPath(entryType, 'follow-up')),
              },
            ]
      }
    >
      <HiFiBuildHero
        kicker={`${config.stepLabel} 已整理`}
        title={config.summaryTitle}
        copy="先确认系统抓到的背景是否贴近真实情况。"
        compact
        mascot={false}
      />

      {aiLoading ? (
        <div className="loading-wrap">
          <div className="loader" aria-hidden="true" />
          <h2>正在整理阶段总结…</h2>
        </div>
      ) : error || !summary ? (
        <section className="section">
          <div className="soft-card">
            <h3>这一步没有整理成功</h3>
            <p>{errorMessage || '可以再试一次。'}</p>
            <button type="button" className="secondary-button" onClick={() => void load()}>
              重试
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="summary-card">
              <h3>系统整理</h3>
              <p className="summary-lead">{summary.mainJudgment}</p>
              {summary.facts.length > 0 ? (
                <ul className="summary-facts">
                  {summary.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              ) : null}
              {summary.pendingHypotheses.length > 0 ? (
                <div className="summary-hypotheses">
                  {summary.pendingHypotheses.map((h) => (
                    <span key={h} className="chip">
                      {h}
                    </span>
                  ))}
                </div>
              ) : null}
              {summary.note ? <p className="summary-note">{summary.note}</p> : null}
            </div>
          </section>
          <section className="section">
            <div className="soft-card">
              <h3>请确认一下</h3>
              <p>{config.confirm}</p>
            </div>
          </section>
        </>
      )}
    </HiFiBuildShell>
  )
}

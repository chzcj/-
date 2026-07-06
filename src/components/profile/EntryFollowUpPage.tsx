'use client'

import { Mic } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FollowUpCard } from '@/components/ai/FollowUpCard'
import { HiFiBuildHero } from '@/components/profile/HiFiBuildHero'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { getEntryConfig } from '@/data/entryConfig'
import {
  MAX_ENTRY_FOLLOW_UP_ROUNDS,
  hasSubmittableEntryText,
  requestEntryFollowUp,
} from '@/lib/profile/entryAnalyze'
import { buildEntryPath, getEntryProgressPercent, type BuildEntryType } from '@/lib/profile/buildEntries'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import { clearEntryGate, loadEntryGate, type EntryFollowUpPayload } from '@/lib/storage/entryGateStorage'
import {
  createFollowUpRecord,
  getCombinedEntryText,
  getFollowUpRecordsForEntry,
  getLatestEntryRecord,
} from '@/lib/storage/entryStorage'
import { clearBuildTextDraft, loadBuildTextDraft, saveBuildTextDraft } from '@/lib/storage/buildTextDraft'

export function EntryFollowUpPage({ entryType }: { entryType: BuildEntryType }) {
  const router = useRouter()
  const config = getEntryConfig(entryType)
  const voice = useTencentAsrInput()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [followUp, setFollowUp] = useState<EntryFollowUpPayload | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [round, setRound] = useState(1)
  const loadedRef = useRef(false)

  const applyFollowUp = useCallback((payload: EntryFollowUpPayload) => {
    setFollowUp(payload)
    setApiError('')
    setRound(Math.max(1, getFollowUpRecordsForEntry(entryType).length + 1))
  }, [entryType])

  const loadFollowUp = useCallback(async (force = false) => {
    if (!force && loadedRef.current) return
    setAiLoading(true)
    setApiError('')

    const combined = getCombinedEntryText(entryType)
    if (!combined) {
      setApiError('还没有首轮记录，请先返回填写。')
      setAiLoading(false)
      return
    }

    const prefetched = loadEntryGate(entryType)
    if (prefetched?.purpose && !force) {
      applyFollowUp(prefetched)
      setAiLoading(false)
      loadedRef.current = true
      return
    }

    const result = await requestEntryFollowUp(entryType, combined)
    if (!result.ok) {
      setApiError(result.error.message || '这一步暂时没有整理成功，可以稍后再试。')
      setAiLoading(false)
      loadedRef.current = true
      return
    }

    applyFollowUp({
      shouldAsk: result.data.shouldAsk !== false,
      purpose: result.data.purpose,
      directions: result.data.directions || [],
      voicePrompt: result.data.voicePrompt || '',
    })

    if (result.data.shouldAsk === false) {
      clearEntryGate(entryType)
      router.replace(buildEntryPath(entryType, 'summary'))
      return
    }

    setAiLoading(false)
    loadedRef.current = true
  }, [applyFollowUp, entryType, router])

  useEffect(() => {
    const latest = getLatestEntryRecord(entryType)
    if (!latest?.rawText) {
      router.replace(buildEntryPath(entryType))
      return
    }
    void loadFollowUp()
  }, [entryType, loadFollowUp, router])

  useEffect(() => {
    setText(loadBuildTextDraft(`followup_${entryType}`))
  }, [entryType])

  useEffect(() => {
    saveBuildTextDraft(`followup_${entryType}`, text)
  }, [text, entryType])

  function toggleVoice() {
    if (loading || aiLoading) return
    if (voice.isListening) {
      const finalText = voice.stopListening() || voice.liveTranscript.trim()
      if (finalText) setText((prev) => (prev ? `${prev.trim()}\n${finalText}` : finalText))
      voice.reset()
      return
    }
    void voice.startListening()
  }

  async function handleSubmit() {
    const answer = text.trim()
    if (!answer || loading || aiLoading || !followUp) return
    setLoading(true)
    setApiError('')
    clearBuildTextDraft(`followup_${entryType}`)

    createFollowUpRecord({
      entryType,
      purpose: followUp.purpose,
      directions: followUp.directions,
      voicePrompt: followUp.voicePrompt,
      userAnswer: answer,
    })

    const combined = getCombinedEntryText(entryType)
    const nextRound = round + 1
    const canAskMore = round < MAX_ENTRY_FOLLOW_UP_ROUNDS

    if (canAskMore) {
      const result = await requestEntryFollowUp(entryType, combined)
      if (!result.ok) {
        setApiError(result.error.message || '系统暂时没判断成功，你可以重试或直接进入整理。')
        setLoading(false)
        return
      }
      if (result.data.shouldAsk !== false) {
        applyFollowUp({
          shouldAsk: true,
          purpose: result.data.purpose,
          directions: result.data.directions || [],
          voicePrompt: result.data.voicePrompt || '',
        })
        setRound(nextRound)
        setText('')
        setLoading(false)
        return
      }
    }

    clearEntryGate(entryType)
    setLoading(false)
    router.push(buildEntryPath(entryType, 'summary'))
  }

  function handleSkipToSummary() {
    if (loading || aiLoading) return
    clearBuildTextDraft(`followup_${entryType}`)
    clearEntryGate(entryType)
    router.push(buildEntryPath(entryType, 'summary'))
  }

  const placeholder = followUp?.voicePrompt || '把刚才想到的补充写在这里…'
  const roundLabel =
    round > 1 ? `第 ${round} 轮补充` : getFollowUpRecordsForEntry(entryType).length > 0 ? '继续补充' : '追问页'

  return (
    <HiFiBuildShell
      topTitle="补充追问"
      stepLabel={`${config.stepLabel} 追问`}
      progress={getEntryProgressPercent(entryType, 'follow-up')}
      onBack={() => router.push(buildEntryPath(entryType))}
      actions={
        aiLoading
          ? []
          : [
              {
                id: 'submit',
                label: loading ? '系统正在判断…' : '提交这段补充',
                onClick: () => void handleSubmit(),
                disabled: !hasSubmittableEntryText(text) || loading || !followUp,
              },
              {
                id: 'voice',
                label: voice.isListening ? '结束录音' : '按住说话',
                variant: 'secondary' as const,
                onClick: toggleVoice,
                disabled: loading,
              },
              {
                id: 'skip',
                label: '暂不补充，直接整理',
                variant: 'quiet' as const,
                onClick: handleSkipToSummary,
                disabled: loading,
              },
            ]
      }
    >
      <HiFiBuildHero
        kicker={`${config.stepLabel} · ${roundLabel}`}
        title="补一段刚才没讲到的细节"
        copy="系统会根据你已讲的内容，判断还要不要继续问。"
        compact
        mascot={false}
      />

      {aiLoading ? (
        <div className="loading-wrap">
          <div className="loader" aria-hidden="true" />
          <h2>正在分析你的输入…</h2>
        </div>
      ) : apiError && !followUp ? (
        <section className="section">
          <div className="soft-card">
            <h3>没生成追问</h3>
            <p>{apiError}</p>
            <button type="button" className="secondary-button" onClick={() => void loadFollowUp(true)}>
              重试
            </button>
          </div>
        </section>
      ) : followUp ? (
        <FollowUpCard
          purpose={followUp.purpose}
          directions={followUp.directions}
          voicePrompt={followUp.voicePrompt}
        />
      ) : null}

      {!aiLoading ? (
        <section className="section">
          <div className="record-box">
            <div className="record-head">
              <strong>补充回答</strong>
              <span className="record-status">{roundLabel}</span>
            </div>
            <textarea
              className="record-area"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              disabled={loading || !followUp}
            />
            <div className="record-meta">
              <span>写多少都可以，系统会判断是否还要追问</span>
              <span>{text.length} 字</span>
            </div>
            {apiError ? <p className="hifi-voice-error">{apiError}</p> : null}
            {voice.error ? <p className="hifi-voice-error">{voice.error}</p> : null}
            {!voice.error && voice.liveTranscript ? (
              <p className="hifi-voice-live">{voice.liveTranscript}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </HiFiBuildShell>
  )
}

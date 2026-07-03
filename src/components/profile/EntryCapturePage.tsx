'use client'

import { Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { HiFiBuildHero } from '@/components/profile/HiFiBuildHero'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { getEntryConfig } from '@/data/entryConfig'
import { hasSubmittableEntryText, requestEntryFollowUp } from '@/lib/profile/entryAnalyze'
import {
  buildEntryPath,
  getEntryProgressPercent,
  type BuildEntryType,
} from '@/lib/profile/buildEntries'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import { clearEntryGate, saveEntryGate } from '@/lib/storage/entryGateStorage'
import { createEntryRecord } from '@/lib/storage/entryStorage'
import {
  clearEntryCaptureDraft,
  loadEntryCaptureDraft,
  saveEntryCaptureDraft,
} from '@/lib/storage/entryCaptureDraft'

export function EntryCapturePage({ entryType }: { entryType: BuildEntryType }) {
  const router = useRouter()
  const config = getEntryConfig(entryType)
  const voice = useTencentAsrInput()
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [draft, setDraft] = useState('')
  const [promptIndex, setPromptIndex] = useState(0)
  const [lightPromptActive, setLightPromptActive] = useState(false)

  useEffect(() => {
    const saved = loadEntryCaptureDraft(entryType)
    setDraft(saved.draft)
    setPromptIndex(saved.promptIndex)
  }, [entryType])

  useEffect(() => {
    saveEntryCaptureDraft(entryType, { draft, promptIndex })
  }, [draft, promptIndex, entryType])

  const currentPrompt = useMemo(
    () => config.prompts[promptIndex % config.prompts.length] || config.prompts[0],
    [config, promptIndex]
  )

  const hasText = hasSubmittableEntryText(draft)
  const recording = voice.isListening

  useEffect(() => {
    if (recording) setLightPromptActive(false)
  }, [recording])

  function appendText(text: string) {
    const t = text.trim()
    if (!t) return
    setDraft((prev) => (prev ? `${prev.trim()}\n${t}` : t))
  }

  const toggleVoice = useCallback(() => {
    if (loading) return
    if (voice.isListening) {
      const finalText = voice.stopListening() || voice.liveTranscript.trim()
      appendText(finalText)
      voice.reset()
      return
    }
    setLightPromptActive(true)
    void voice.startListening()
  }, [loading, voice])

  function handleChip(chip: string) {
    setDraft((prev) => (prev ? `${prev}\n${chip}：` : `${chip}：`))
    setLightPromptActive(true)
  }

  async function handleContinue() {
    const merged = draft.trim()
    if (!merged || loading || !hasSubmittableEntryText(merged)) return
    setLoading(true)
    setApiError('')

    // 硬规则：<50 字强制追问，不调 AI、绝对不可绕过。
    // 四模块（daily/homework/communication/family）都适用；final 收尾追问走独立页面，天然豁免，避免死循环。
    // 目的：信息太薄时 AI 容易 shouldAsk:false 跳过，导致阶段总结无料可写；强制至少一个具体场景。
    const forceFollowUp = merged.length < 50
    const gate = forceFollowUp
      ? {
          ok: true as const,
          data: {
            shouldAsk: true,
            purpose: '信息太少了，想先听一个具体场景，好区分方向。',
            directions: [] as string[],
            voicePrompt: '能不能挑最近最头疼的一次，按当时发生的原话多讲几句？不用整理成道理，顺着说就行。',
          },
        }
      : await requestEntryFollowUp(entryType, merged)

    if (!gate.ok) {
      setApiError(gate.error.message || '这一步暂时没有整理成功，可以稍后再试。')
      setLoading(false)
      return
    }

    clearEntryCaptureDraft(entryType)
    clearEntryGate(entryType)
    createEntryRecord({ entryType, rawText: merged })

    if (gate.data.shouldAsk === false) {
      router.push(buildEntryPath(entryType, 'summary'))
    } else {
      saveEntryGate(entryType, {
        shouldAsk: true,
        purpose: gate.data.purpose,
        directions: gate.data.directions || [],
        voicePrompt: gate.data.voicePrompt || '',
      })
      router.push(buildEntryPath(entryType, 'follow-up'))
    }
    setLoading(false)
  }

  const primaryAction = recording
    ? { id: 'voice', label: '结束录音', icon: <Mic size={18} />, onClick: toggleVoice, disabled: loading }
    : hasText
      ? {
          id: 'submit',
          label: loading ? '系统正在看信息够不够…' : '提交，让系统看看',
          onClick: () => void handleContinue(),
          disabled: loading,
        }
      : {
          id: 'voice',
          label: voice.asrUnavailable ? '语音暂不可用，请打字' : '开始说这一段',
          icon: <Mic size={18} />,
          onClick: toggleVoice,
          disabled: loading || voice.asrUnavailable,
        }

  return (
    <HiFiBuildShell
      topTitle={config.title}
      stepLabel={`${config.stepLabel} 专项采集`}
      progress={getEntryProgressPercent(entryType, 'input')}
      onBack={() => router.push('/profile/build')}
      actions={[primaryAction]}
    >
      <HiFiBuildHero
        kicker={`${config.stepLabel} 专项采集`}
        title={config.title}
        copy={config.subtitle}
        compact
      />

      <section className="section">
        <div className="soft-card">
          <p>{config.body}</p>
          <div className="hint-block">{config.defaultHint}</div>
        </div>
      </section>

      <section className="section">
        <div className="record-box">
          <div className="record-head">
            <strong>真实情况记录</strong>
            <span className="record-status">建议 30 秒以上</span>
          </div>
          <textarea
            className="record-area"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={config.placeholder.replace(/\\n/g, '\n')}
            disabled={loading}
          />
          <div className="record-meta">
            <span>系统会先整理，不直接下结论</span>
            <span>{draft.length} 字</span>
          </div>

          <div className={`recording-strip${recording ? ' active' : ''}`}>
            <div className="recording-card">
              <div className="wave" aria-hidden="true">
                {Array.from({ length: 7 }).map((_, i) => (
                  <span key={i} />
                ))}
              </div>
              <p className="recording-text">正在记录</p>
              <p className="cancel-hint">不用停下来整理，顺着讲就好</p>
            </div>
          </div>

          <div className={`light-prompt${lightPromptActive || draft.length > 0 ? ' active' : ''}`}>
            {currentPrompt}
          </div>

          {apiError ? <p className="hifi-voice-error">{apiError}</p> : null}
          {voice.error ? <p className="hifi-voice-error">{voice.error}</p> : null}
          {!voice.error && voice.liveTranscript ? (
            <p className="hifi-voice-live">{voice.liveTranscript}</p>
          ) : null}
        </div>
      </section>

      <section className="section">
        <p className="section-title">可以顺着这些方向讲</p>
        <div className="chips">
          {config.chips.map((chip) => (
            <button key={chip} type="button" className="chip" onClick={() => handleChip(chip)}>
              {chip}
            </button>
          ))}
        </div>
      </section>
    </HiFiBuildShell>
  )
}

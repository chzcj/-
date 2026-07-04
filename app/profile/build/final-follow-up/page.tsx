'use client'

import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { HiFiBuildHero } from '@/components/profile/HiFiBuildHero'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { FollowUpCard } from '@/components/ai/FollowUpCard'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import { createFollowUpRecord } from '@/lib/storage/entryStorage'
import { getStorage } from '@/lib/storage/localStorageService'
import { clearBuildTextDraft, loadBuildTextDraft, saveBuildTextDraft } from '@/lib/storage/buildTextDraft'
import { requestFinalFollowUp } from '@/lib/profile/entryAnalyze'

type FinalQuestion = { purpose: string; directions: string[]; voicePrompt: string }

export default function FinalFollowUpPage() {
  const router = useRouter()
  const voice = useTencentAsrInput()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fu, setFu] = useState<FinalQuestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [errorMessage, setErrorMessage] = useState('')

  async function load() {
    setLoading(true)
    setError(false)
    setErrorMessage('')
    try {
      const summaries = (getStorage().stageSummaries || [])
        .map((s) => `[${s.entryType}] ${s.mainJudgment}`)
        .filter(Boolean)
      const rawText = summaries.join('\n') || '家长已完成四个模块的初步描述，请给一个最关键的综合追问。'
      const result = await requestFinalFollowUp(rawText)
      if (result.ok) {
        setFu({
          purpose: result.data.purpose,
          directions: result.data.directions || [],
          voicePrompt: result.data.voicePrompt || '',
        })
      } else {
        setError(true)
        setErrorMessage(result.error.message || '这一步暂时没有整理成功，可以稍后再试。')
      }
    } catch {
      setError(true)
      setErrorMessage('网络不太稳定，可以稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setText(loadBuildTextDraft('final_follow_up'))
  }, [])

  useEffect(() => {
    saveBuildTextDraft('final_follow_up', text)
  }, [text])

  function toggleVoice() {
    if (submitting || loading) return
    if (voice.isListening) {
      const finalText = voice.stopListening() || voice.liveTranscript.trim()
      if (finalText) setText((prev) => (prev ? `${prev.trim()}\n${finalText}` : finalText))
      voice.reset()
      return
    }
    void voice.startListening()
  }

  function handleSubmit() {
    if (!text.trim() || submitting) return
    setSubmitting(true)
    clearBuildTextDraft('final_follow_up')
    createFollowUpRecord({
      entryType: 'final',
      purpose: fu?.purpose || '四模块综合补充',
      directions: fu?.directions || [],
      voicePrompt: fu?.voicePrompt || '',
      userAnswer: text.trim(),
    })
    router.push('/profile/generating')
  }

  const placeholder = fu?.voicePrompt || '把刚才想到的场景写在这里…'

  return (
    <HiFiBuildShell
      topTitle="综合补充"
      stepLabel="收尾追问"
      progress={92}
      onBack={() => router.push('/profile/build')}
      actions={
        loading
          ? []
          : [
              {
                label: submitting ? '正在进入建模…' : '继续补充，生成画像',
                icon: <ArrowRight size={18} />,
                onClick: handleSubmit,
                disabled: !text.trim() || submitting,
              },
              {
                label: voice.isListening ? '结束录音' : '按住说话',
                variant: 'secondary',
                onClick: toggleVoice,
                disabled: submitting,
              },
            ]
      }
    >
      <HiFiBuildHero
        kicker="四模块收尾"
        title="四个模块已经基本够了，我还想再补一个关键点"
        copy="这一步很关键，能帮系统把主判断收得更准。"
        compact
        mascot={false}
      />

      {loading ? (
        <div className="loading-wrap">
          <div className="loader" aria-hidden="true" />
          <h2>正在整理综合追问…</h2>
        </div>
      ) : error ? (
        <section className="section">
          <div className="soft-card">
            <h3>这一步没有整理成功</h3>
            <p>{errorMessage || '可以再试一次。'}</p>
            <button type="button" className="secondary-button" onClick={() => void load()}>
              重试
            </button>
          </div>
        </section>
      ) : fu ? (
        <FollowUpCard purpose={fu.purpose} directions={fu.directions} voicePrompt={fu.voicePrompt} />
      ) : null}

      {!loading ? (
        <section className="section">
          <div className="record-box">
            <div className="record-head">
              <strong>补充回答</strong>
              <span className="record-status">收尾追问</span>
            </div>
            <textarea
              className="record-area"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              disabled={submitting}
            />
            <div className="record-meta">
              <span>{text.length} 字</span>
            </div>
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

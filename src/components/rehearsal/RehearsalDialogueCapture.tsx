'use client'

import { useCallback, useState } from 'react'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import { AuthorityInsightCard } from '@/components/hifi/AuthorityInsightCard'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { getChildDisplayName } from '@/lib/storage/childStorage'

type DialogueSegment = {
  speaker: string
  text: string
  highlight?: boolean
  highlightReason?: string
}

type AnalyzeResult = {
  segments: DialogueSegment[]
  analysis: string
  tryTonight?: string
}

export function RehearsalDialogueCapture() {
  const voice = useTencentAsrInput()
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalyzeResult | null>(null)

  const appendTranscript = useCallback((text: string) => {
    const t = text.trim()
    if (!t) return
    setTranscript((prev) => (prev ? `${prev}\n${t}` : t))
  }, [])

  const toggleRecord = useCallback(() => {
    if (loading) return
    if (voice.isListening) {
      appendTranscript(voice.stopListening() || voice.liveTranscript)
      voice.reset()
      return
    }
    void voice.startListening()
  }, [appendTranscript, loading, voice])

  async function analyze() {
    const text = transcript.trim()
    if (!text || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/rehearsal/dialogue-analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      const json = await res.json()
      if (!json.ok) {
        setError(json.error?.message || '分析暂时没有成功，可以稍后再试。')
        return
      }
      setResult(json.data as AnalyzeResult)
    } catch {
      setError('网络有点忙，可以稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  const childCopy = childSystemCopy(getChildDisplayName())

  return (
    <section className="section rehearsal-dialogue-section">
      <h2 className="section-title">记录亲子对话</h2>
      <p className="hint-text">{childCopy.dialogueCaptureHint}</p>

      <div className="soft-card">
        <textarea
          className="record-area"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="转写文字会出现在这里，也可直接粘贴对话记录…"
          rows={5}
          disabled={loading}
        />
        <div className="rehearsal-dialogue-actions">
          <button
            type="button"
            className={`secondary-button${voice.isListening ? ' active' : ''}`}
            onPointerDown={() => { if (!voice.isListening) void voice.startListening() }}
            onPointerUp={toggleRecord}
            onPointerLeave={() => { if (voice.isListening) toggleRecord() }}
            disabled={loading}
          >
            {voice.isListening ? '松手结束' : '按住录音'}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void analyze()}
            disabled={loading || !transcript.trim()}
          >
            {loading ? '分析中…' : '深度解读'}
          </button>
        </div>
      </div>

      {error ? <p className="startup-error">{error}</p> : null}

      {result ? (
        <>
          <AuthorityInsightCard title="育见解读" body={result.analysis} />
          {result.tryTonight ? (
            <p className="hint-text">今晚可试：{result.tryTonight}</p>
          ) : null}
          <div className="dialogue-transcript-list">
            {result.segments.map((seg, i) => (
              <p key={`${i}-${seg.text.slice(0, 12)}`} className={seg.highlight ? 'dialogue-highlight' : undefined}>
                <strong>{seg.speaker}：</strong>
                {seg.text}
                {seg.highlight && seg.highlightReason ? (
                  <span className="dialogue-highlight-reason"> — {seg.highlightReason}</span>
                ) : null}
              </p>
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}

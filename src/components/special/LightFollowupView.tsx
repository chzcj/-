'use client'

import { useState } from 'react'
import { VoiceFieldButton, appendTranscript } from '@/components/voice/VoiceFieldButton'

export interface LightFollowupViewProps {
  acknowledgement: string
  question: string
  missingInfo?: string[]
  loading: boolean
  onSubmit: (text: string) => void
}

export function LightFollowupView({
  acknowledgement,
  question,
  missingInfo = [],
  loading,
  onSubmit,
}: LightFollowupViewProps) {
  const [text, setText] = useState('')
  const disabled = loading || !text.trim()

  return (
    <div className="task-feedback-panel">
      {acknowledgement ? <p className="feedback-title">{acknowledgement}</p> : null}

      <p className="feedback-question">{question}</p>

      {missingInfo.length > 0 ? (
        <div className="layer-tags" style={{ marginBottom: 12 }}>
          {missingInfo.slice(0, 4).map((m) => (
            <span key={m} className="tag">
              {m}
            </span>
          ))}
        </div>
      ) : null}

      <textarea
        className="feedback-note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="不用说得很完整，凭最近几次印象说就行"
        disabled={loading}
      />

      <VoiceFieldButton
        disabled={loading}
        idleLabel="说一说，自动转文字"
        onTranscript={(t) => setText((prev) => appendTranscript(prev, t))}
        style={{ marginTop: 10 }}
      />

      <div className="feedback-actions">
        <button type="button" className="secondary-button" disabled={disabled} onClick={() => onSubmit(text.trim())}>
          {loading ? '正在结合你说的看…' : '说说看'}
        </button>
      </div>
    </div>
  )
}

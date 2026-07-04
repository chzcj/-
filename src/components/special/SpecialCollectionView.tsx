'use client'

import { useState } from 'react'
import { VoiceFieldButton, appendTranscript } from '@/components/voice/VoiceFieldButton'

export interface SpecialCollectionViewProps {
  title: string
  subtitle: string
  inputGuides: string[]
  placeholder: string
  primaryActionText: string
  loadingText?: string
  loading: boolean
  extraGuide?: string
  onSubmit: (text: string) => void
}

export function SpecialCollectionView({
  title,
  subtitle,
  inputGuides,
  placeholder,
  primaryActionText,
  loadingText,
  loading,
  extraGuide,
  onSubmit,
}: SpecialCollectionViewProps) {
  const [text, setText] = useState('')
  const disabled = loading || !text.trim()

  return (
    <section className="section">
      <div className="rehearsal-header">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      {extraGuide ? (
        <div className="soft-card" style={{ marginTop: 12 }}>
          <p>{extraGuide}</p>
        </div>
      ) : null}

      {inputGuides.length > 0 ? (
        <div className="layer-tags" style={{ marginTop: 12 }}>
          {inputGuides.map((g) => (
            <span key={g} className="tag">
              {g}
            </span>
          ))}
        </div>
      ) : null}

      <div className="feedback-panel" style={{ marginTop: 14 }}>
        <p className="feedback-question">写下你准备说的话</p>
        <textarea
          className="feedback-note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          maxLength={4000}
          aria-label={title}
          style={{ minHeight: 150 }}
        />

        <VoiceFieldButton
          disabled={loading}
          idleLabel="说一说，自动转文字"
          onTranscript={(t) => setText((prev) => appendTranscript(prev, t))}
          style={{ marginTop: 10 }}
        />

        <div className="feedback-actions">
          <button type="button" className="primary-button wide-button" disabled={disabled} onClick={() => onSubmit(text.trim())}>
            {loading ? loadingText || '正在梳理…' : primaryActionText}
          </button>
        </div>
      </div>
    </section>
  )
}

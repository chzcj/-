'use client'

import { getChildDisplayName } from '@/lib/storage/childStorage'

type SimulationSecondMeBubbleProps = {
  childText: string
  hintTitle: string
  hintText: string
  suggestedTitle?: string
  suggestedText?: string
}

export function SimulationSecondMeBubble({
  childText,
  hintTitle,
  hintText,
  suggestedTitle,
  suggestedText,
}: SimulationSecondMeBubbleProps) {
  const childName = getChildDisplayName()

  return (
    <div className="message-row ai">
      <div className="bubble">
        <div className="bubble-section">
          <span className="section-label">{childName} SecondMe</span>
          <div className="section-body">{childText}</div>
        </div>
        <div className="hint-block">
          <p className="hint-block-title">{hintTitle}</p>
          <p className="hint-block-text">{hintText}</p>
        </div>
        {suggestedText ? (
          <div className="hint-block">
            <p className="hint-block-title">{suggestedTitle || '您可以这样说'}</p>
            <p className="hint-block-text">{suggestedText}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function SimulationSystemHintBubble({ text }: { text: string }) {
  return (
    <div className="message-row ai rehearsal-system-hint">
      <div className="bubble">
        <div className="bubble-section">
          <div className="section-body">{text}</div>
        </div>
      </div>
    </div>
  )
}

export function SimulationParentBubble({ text }: { text: string }) {
  return (
    <div className="message-row user">
      <div className="bubble">{text}</div>
    </div>
  )
}

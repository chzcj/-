'use client'

import { getChildDisplayName } from '@/lib/storage/childStorage'

function childAvatarLabel(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '孩'
  return trimmed.slice(-1)
}

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
  const avatarLabel = childAvatarLabel(childName)

  return (
    <div className="rehearsal-msg rehearsal-msg--child">
      <div className="rehearsal-avatar" aria-hidden="true">
        {avatarLabel}
      </div>
      <div className="rehearsal-msg-col">
        <div className="rehearsal-child-stack">
          <div className="rehearsal-bubble rehearsal-bubble--child">
            <p className="rehearsal-bubble-text">{childText}</p>
          </div>
          {hintText ? (
            <aside className="rehearsal-child-insight">
              <p className="rehearsal-child-insight-label">{hintTitle}</p>
              <p className="rehearsal-child-insight-body">{hintText}</p>
            </aside>
          ) : null}
          {suggestedText ? (
            <aside className="rehearsal-child-insight rehearsal-child-insight--suggest">
              <p className="rehearsal-child-insight-label">{suggestedTitle || '您可以这样说'}</p>
              <p className="rehearsal-child-insight-body">{suggestedText}</p>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function SimulationSystemHintBubble({ text }: { text: string }) {
  return (
    <div className="rehearsal-system-hint">
      <p className="rehearsal-system-hint-text">{text}</p>
    </div>
  )
}

export function SimulationParentBubble({ text }: { text: string }) {
  return (
    <div className="rehearsal-msg rehearsal-msg--parent">
      <div className="rehearsal-msg-col">
        <div className="rehearsal-bubble rehearsal-bubble--parent">
          <p className="rehearsal-bubble-text">{text}</p>
        </div>
      </div>
      <div className="rehearsal-avatar rehearsal-avatar--parent" aria-hidden="true">
        我
      </div>
    </div>
  )
}

export function SimulationThinkingBubble() {
  return (
    <div className="rehearsal-msg rehearsal-msg--child">
      <div className="rehearsal-avatar" aria-hidden="true">
        …
      </div>
      <div className="rehearsal-msg-col">
        <div className="rehearsal-bubble rehearsal-bubble--child thinking-bubble">
          <span className="thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'

type HiFiInputZoneProps = {
  /** 真正只读（如全局禁用），与 busy 区分：busy 仍允许打字/排队，只是给过渡提示 */
  disabled?: boolean
  busy?: boolean
  /** 生成中已排队的待发条数 */
  queuedCount?: number
  placeholder?: string
  onSubmit: (text: string, mode: 'voice' | 'text') => void
}

export function HiFiInputZone({
  disabled,
  busy = false,
  queuedCount = 0,
  placeholder = '随时和我聊聊孩子的情况……',
  onSubmit,
}: HiFiInputZoneProps) {
  const voice = useTencentAsrInput()
  const [textMode, setTextMode] = useState(false)
  const [text, setText] = useState('')
  const holdButtonRef = useRef<HTMLButtonElement>(null)
  const activePointerRef = useRef<number | null>(null)
  const holdingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const live = voice.liveTranscript

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`
  }, [])

  const releasePointerCapture = useCallback(() => {
    const btn = holdButtonRef.current
    const pointerId = activePointerRef.current
    if (btn && pointerId != null && btn.hasPointerCapture(pointerId)) {
      btn.releasePointerCapture(pointerId)
    }
    activePointerRef.current = null
  }, [])

  const stopVoiceSession = useCallback(() => {
    holdingRef.current = false
    releasePointerCapture()
    if (voice.isListening) {
      voice.stopListening()
    }
    voice.reset()
  }, [releasePointerCapture, voice])

  const finishVoice = useCallback(() => {
    holdingRef.current = false
    releasePointerCapture()
    if (disabled) return
    const finalText = voice.stopListening() || live.trim()
    if (finalText) {
      onSubmit(finalText, 'voice')
      voice.reset()
    }
  }, [disabled, live, onSubmit, releasePointerCapture, voice])

  const startHold = useCallback(() => {
    if (disabled || voice.isListening || holdingRef.current) return
    holdingRef.current = true
    void voice.startListening()
  }, [disabled, voice])

  const submitText = useCallback(() => {
    const value = text.trim()
    if (!value || disabled) return
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onSubmit(value, 'text')
  }, [disabled, onSubmit, text])

  const switchToTextMode = useCallback(() => {
    stopVoiceSession()
    setTextMode(true)
  }, [stopVoiceSession])

  const switchToVoiceMode = useCallback(() => {
    setTextMode(false)
  }, [])

  useEffect(() => {
    if (textMode) resizeTextarea()
  }, [textMode, text, resizeTextarea])

  useEffect(() => {
    const endHold = () => {
      if (!holdingRef.current) return
      finishVoice()
    }
    window.addEventListener('pointerup', endHold)
    window.addEventListener('touchend', endHold)
    return () => {
      window.removeEventListener('pointerup', endHold)
      window.removeEventListener('touchend', endHold)
    }
  }, [finishVoice])

  return (
    <div className="input-dock">
      <section className={`recording-panel${voice.isListening ? ' active' : ''}`} aria-live="assertive">
        <div className="recording-card">
          <div className="wave" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <p className="recording-text">松手发送，上滑取消</p>
          <p className="cancel-hint">{live || '继续按住说话'}</p>
        </div>
      </section>

      <section className="input-zone">
        <div className={`input-bar voice-mode${textMode ? ' hidden' : ''}`}>
          <button
            ref={holdButtonRef}
            className="hold-button"
            type="button"
            disabled={disabled}
            aria-label="按住说话"
            onPointerDown={(e) => {
              if (disabled) return
              activePointerRef.current = e.pointerId
              e.currentTarget.setPointerCapture(e.pointerId)
              startHold()
            }}
            onPointerUp={() => finishVoice()}
            onPointerCancel={() => finishVoice()}
            onLostPointerCapture={() => {
              activePointerRef.current = null
              if (holdingRef.current) stopVoiceSession()
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="hold-button-label">按住说话</span>
          </button>
          <button
            className="mode-button"
            type="button"
            aria-label="切换到文字输入"
            disabled={disabled}
            onClick={switchToTextMode}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 15h10M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className={`input-bar text-mode${textMode ? '' : ' hidden'}`}>
          <button
            className="mode-button"
            type="button"
            aria-label="切换到语音输入"
            disabled={disabled}
            onClick={switchToVoiceMode}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="text-input-wrap">
            <textarea
              ref={textareaRef}
              className="text-input"
              rows={1}
              placeholder={placeholder}
              value={text}
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value)
                resizeTextarea()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submitText()
                }
              }}
            />
          </div>
          <button
            className="send-button"
            type="button"
            aria-label="发送"
            disabled={disabled || !text.trim()}
            onClick={submitText}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {voice.error ? (
          <p className="hint-text" style={{ padding: '0 16px 8px', color: 'var(--danger)' }}>
            {voice.error}
          </p>
        ) : null}
      </section>
    </div>
  )
}

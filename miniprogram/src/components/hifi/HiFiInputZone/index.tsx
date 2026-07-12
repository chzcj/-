import { useEffect, useRef, useState } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import './index.scss'

export type VoiceHoldMode = 'send' | 'fill'

type HiFiInputZoneProps = {
  disabled?: boolean
  busy?: boolean
  queuedCount?: number
  placeholder?: string
  voiceMode?: VoiceHoldMode
  onSubmit: (text: string, mode: 'voice' | 'text') => void
}

export function HiFiInputZone({
  disabled,
  busy = false,
  queuedCount = 0,
  placeholder = '随时和我聊聊孩子的情况……',
  voiceMode = 'send',
  onSubmit,
}: HiFiInputZoneProps) {
  const voice = useTencentAsrInput()
  const [textMode, setTextMode] = useState(false)
  const [text, setText] = useState('')
  const [cursor, setCursor] = useState(-1)
  const [shortTapHint, setShortTapHint] = useState('')
  /** 同步按住态：不依赖 ASR，按下立刻出波浪/连接中 */
  const [uiHolding, setUiHolding] = useState(false)
  const touchStartAtRef = useRef(0)
  const holdingRef = useRef(false)
  const pendingStopRef = useRef(false)
  const voiceSubmittedRef = useRef(false)

  /** busy 时仍可输入并排队；仅外部 disabled 才真正锁住 */
  const holdBlocked = Boolean(disabled)

  const submitText = () => {
    const value = text.trim()
    if (!value || disabled) return
    voice.clearError()
    voice.reset()
    setText('')
    setCursor(-1)
    onSubmit(value, 'text')
  }

  const applyVoiceText = (value: string, fromRefined = false) => {
    const trimmed = value.trim()
    if (!trimmed) return

    if (voiceMode === 'send') {
      if (voiceSubmittedRef.current && fromRefined) return
      voiceSubmittedRef.current = true
      onSubmit(trimmed, 'voice')
      voice.reset()
      return
    }

    setText((prev) => {
      const next =
        !fromRefined || !prev
          ? prev
            ? `${prev}\n${trimmed}`
            : trimmed
          : (() => {
              const lines = prev.split('\n')
              lines[lines.length - 1] = trimmed
              return lines.join('\n')
            })()
      setCursor(next.length)
      return next
    })
    setTextMode(true)
    if (fromRefined) voice.reset()
  }

  const finishVoice = () => {
    const wasHolding = holdingRef.current
    holdingRef.current = false
    setUiHolding(false)
    if (!wasHolding && !pendingStopRef.current) return

    const heldMs = Date.now() - touchStartAtRef.current
    if (wasHolding && heldMs < voice.minHoldMs) {
      setShortTapHint('请按住说话')
      setTimeout(() => setShortTapHint(''), 2200)
      void voice.stopListening({ fast: true })
      voice.reset()
      return
    }

    if (voice.isConnecting) {
      pendingStopRef.current = true
      return
    }

    const snapshot = voice.getTranscript()
    if (!voice.isListening && !snapshot && !pendingStopRef.current) return

    pendingStopRef.current = false
    voiceSubmittedRef.current = false

    if (snapshot) applyVoiceText(snapshot)

    void voice
      .stopListening({
        fast: true,
        onRefined: (refined) => {
          if (!refined.trim()) return
          setShortTapHint('')
          if (voiceMode === 'fill') {
            applyVoiceText(refined, true)
            voice.reset()
          } else if (!voiceSubmittedRef.current) {
            applyVoiceText(refined)
          }
        },
      })
      .then((snapshotText) => {
        if (!snapshotText.trim()) {
          setShortTapHint('没听清，请再试或改用文字')
          setTimeout(() => setShortTapHint(''), 2400)
        }
      })
  }

  const startVoice = () => {
    // 同步 UI：按下立刻波浪 + 连接中，不依赖 await
    setUiHolding(true)
    setShortTapHint('')
    if (holdingRef.current) return
    if (holdBlocked) {
      setUiHolding(false)
      setShortTapHint('当前不可输入')
      setTimeout(() => setShortTapHint(''), 2200)
      return
    }
    holdingRef.current = true
    touchStartAtRef.current = Date.now()
    pendingStopRef.current = false
    voiceSubmittedRef.current = false
    voice.clearError()
    void voice.startListening()
  }

  useEffect(() => {
    if (!voice.error) return
    holdingRef.current = false
    pendingStopRef.current = false
    setUiHolding(false)
  }, [voice.error])

  useEffect(() => {
    if (!pendingStopRef.current) return
    if (voice.isConnecting) return
    if (voice.isListening || voice.liveTranscript) finishVoice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.isConnecting, voice.isListening, voice.liveTranscript])

  const holdActive = uiHolding || voice.isListening || voice.isConnecting

  const holdLabel = voice.asrUnavailable
    ? '语音不可用'
    : uiHolding && !voice.isListening
      ? '连接中…'
      : voice.isConnecting
        ? '连接中…'
        : voice.isListening
          ? '松手结束'
          : '按住说话'

  const busyHint = busy
    ? queuedCount > 0
      ? `生成中，已排队 ${queuedCount} 条`
      : '生成中…可继续输入，将排队发送'
    : ''

  return (
    <View className='input-dock-inner'>
      <View className='input-zone'>
        {voice.simulatorUnsupported && !textMode ? (
          <Text className='hint-text simulator-asr-hint'>
            模拟器不支持语音，请用真机预览或点「文」打字
          </Text>
        ) : null}

        {!textMode ? (
          <View className='input-bar voice-mode'>
            <View
              className={`hold-button${holdActive ? ' active' : ''}${
                voice.isConnecting || (uiHolding && !voice.isListening) ? ' connecting' : ''
              }${holdBlocked || voice.asrUnavailable ? ' is-disabled' : ''}`}
              hoverClass='none'
              onTouchStart={startVoice}
              onTouchEnd={finishVoice}
              onTouchCancel={finishVoice}
            >
              {holdActive ? (
                <View className='hold-button-wave' aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <View key={i} className='hold-button-wave-bar' />
                  ))}
                </View>
              ) : (
                <Text className='hold-button-label'>{holdLabel}</Text>
              )}
            </View>
            <Button
              className='mode-button'
              disabled={disabled}
              onClick={() => {
                voice.clearError()
                voice.reset()
                setTextMode(true)
              }}
            >
              <Text>文</Text>
            </Button>
          </View>
        ) : (
          <View className='input-bar text-mode'>
            <Button
              className='mode-button'
              disabled={disabled}
              onClick={() => {
                voice.clearError()
                setTextMode(false)
              }}
            >
              <Text>🎤</Text>
            </Button>
            <View className='text-input-wrap'>
              <Textarea
                className='text-input'
                value={text}
                cursor={cursor < 0 ? undefined : cursor}
                disabled={disabled}
                placeholder={placeholder}
                maxlength={2000}
                autoHeight
                adjustPosition
                holdKeyboard
                cursorSpacing={72}
                confirmType='send'
                onInput={(e) => {
                  setText(e.detail.value)
                  setCursor(-1)
                }}
                onConfirm={submitText}
              />
            </View>
            <Button className='send-button' disabled={disabled || !text.trim()} onClick={submitText}>
              <Text>→</Text>
            </Button>
          </View>
        )}
        <View className='input-zone-status'>
          {busyHint ? <Text className='hint-text'>{busyHint}</Text> : null}
          {holdActive && holdLabel !== '按住说话' ? (
            <Text className='hint-text input-voice-status'>{holdLabel}</Text>
          ) : null}
          {shortTapHint ? <Text className='hint-text'>{shortTapHint}</Text> : null}
          {!holdActive && !textMode && voice.error ? (
            <Text className='hint-text input-voice-error'>{voice.error}</Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}

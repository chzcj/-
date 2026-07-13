import { useEffect, useRef, useState } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import { ensureRecordPermission, getRecordAuthStatus } from '@/lib/asrPermission'
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
  /** 仅表示手指是否按下——松手立刻 false，不绑 ASR connecting */
  const [fingerDown, setFingerDown] = useState(false)
  const touchStartAtRef = useRef(0)
  const holdingRef = useRef(false)
  const voiceSubmittedRef = useRef(false)
  const finishingRef = useRef(false)

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
    // H0：松手立刻退出按住视觉，不依赖 ASR 状态
    setFingerDown(false)
    const wasHolding = holdingRef.current
    holdingRef.current = false
    if (!wasHolding || finishingRef.current) return

    const heldMs = Date.now() - touchStartAtRef.current
    if (heldMs < voice.minHoldMs) {
      // 短于误触阈值：静默，不提示、不撑 dock
      void voice.stopListening({ fast: true })
      voice.reset()
      return
    }

    finishingRef.current = true
    voiceSubmittedRef.current = false

    const snapshot = voice.getTranscript()
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
        finishingRef.current = false
        if (!snapshotText.trim() && !voiceSubmittedRef.current) {
          setShortTapHint('没听清，请再试或改用文字')
          setTimeout(() => setShortTapHint(''), 2400)
        }
      })
      .catch(() => {
        finishingRef.current = false
      })
  }

  const startVoice = () => {
    setShortTapHint('')
    if (holdingRef.current) return
    if (holdBlocked) {
      setFingerDown(false)
      setShortTapHint('当前不可输入')
      setTimeout(() => setShortTapHint(''), 2200)
      return
    }
    // H0：先标按下，子树结构不变（波浪用 CSS 显隐）
    setFingerDown(true)
    holdingRef.current = true
    touchStartAtRef.current = Date.now()
    voiceSubmittedRef.current = false
    finishingRef.current = false
    voice.clearError()

    void (async () => {
      // 首次必须先拿到麦克风权限（隐私+authorize 弹窗都不依赖按住手势，
      // 即使松手也要走完申请——否则快速点按会静默吞掉授权，什么弹窗都不出现）
      const status = await getRecordAuthStatus()

      if (status !== 'granted') {
        setFingerDown(false)
        holdingRef.current = false
        const perm = await ensureRecordPermission({ interactive: true })
        if (!perm.ok) {
          // 失败提示持久显示，下次按住时清除（authorize 可能数秒后才返回，定时消失会没人看见）
          setShortTapHint(perm.message)
          return
        }
        setShortTapHint('麦克风已开启，请再次按住说话')
        setTimeout(() => setShortTapHint(''), 2800)
        return
      }

      if (!holdingRef.current) return
      void voice.startListening()
    })()
  }

  useEffect(() => {
    if (!voice.error) return
    holdingRef.current = false
    finishingRef.current = false
    setFingerDown(false)
  }, [voice.error])

  // 视觉：跟手指；录音就绪时加强 active。禁止绑 isConnecting 导致松手不复位
  const pressVisual = fingerDown || voice.isListening
  const holdLabel = voice.asrUnavailable
    ? '语音不可用'
    : fingerDown || voice.isListening
      ? '松手结束'
      : '按住说话'

  // busy/queuedCount 暂不渲染任何提示：生成中的排队提示会把底部 dock 撑高，
  // 黄色背景遮住正文、按钮位置跳动（用户反馈体感差）。排队逻辑本身保留。

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
              className={`hold-button${pressVisual ? ' active' : ''}${
                holdBlocked || voice.asrUnavailable ? ' is-disabled' : ''
              }`}
              hoverClass='none'
              onTouchStart={startVoice}
              onTouchEnd={finishVoice}
              onTouchCancel={finishVoice}
            >
              {/* H0：波浪与文案始终同在，只用 class 显隐，避免换子树丢 touchEnd */}
              <View className={`hold-button-wave${pressVisual ? ' is-visible' : ''}`} aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <View key={i} className='hold-button-wave-bar' />
                ))}
              </View>
              <Text className={`hold-button-label${pressVisual ? ' is-hidden' : ''}`}>{holdLabel}</Text>
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
          {shortTapHint ? <Text className='hint-text'>{shortTapHint}</Text> : null}
          {!textMode && voice.error ? (
            <Text className='hint-text input-voice-error'>{voice.error}</Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}

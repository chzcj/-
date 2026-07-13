import { View, Text, Textarea } from '@tarojs/components'
import { useRef, useEffect, useState } from 'react'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import { ensureRecordPermission, getRecordAuthStatus } from '@/lib/asrPermission'
import { getEntryCaptureCharHint } from '@/lib/entryCharHint'

const MAX_LENGTH = 4000

type BuildRecordBoxProps = {
  label: string
  status: string
  value: string
  placeholder: string
  disabled?: boolean
  metaLeft?: string
  prompt?: string
  showCharHint?: boolean
  onChange: (value: string) => void
  onVoiceText?: (text: string) => void
}

export function BuildRecordBox({
  label,
  status,
  value,
  placeholder,
  disabled,
  metaLeft = '说清楚就行，后面会帮你整理。',
  prompt,
  showCharHint = true,
  onChange,
  onVoiceText,
}: BuildRecordBoxProps) {
  const voice = useTencentAsrInput()
  const charCount = value.trim().length
  const charHint = getEntryCaptureCharHint(charCount)
  const touchStartAtRef = useRef(0)
  const holdingRef = useRef(false)
  const finishingRef = useRef(false)
  const [fingerDown, setFingerDown] = useState(false)
  const [permHint, setPermHint] = useState('')

  const finishVoice = () => {
    setFingerDown(false)
    const wasHolding = holdingRef.current
    holdingRef.current = false
    if (!wasHolding || finishingRef.current) return
    if (Date.now() - touchStartAtRef.current < voice.minHoldMs) {
      void voice.stopListening({ fast: true })
      voice.reset()
      return
    }
    finishingRef.current = true
    void voice
      .stopListening({ fast: true })
      .then((finalText) => {
        finishingRef.current = false
        voice.reset()
        if (finalText) {
          onChange(value ? `${value.trim()}\n${finalText}` : finalText)
          onVoiceText?.(finalText)
        }
      })
      .catch(() => {
        finishingRef.current = false
      })
  }

  useEffect(() => {
    if (!voice.error) return
    holdingRef.current = false
    finishingRef.current = false
    setFingerDown(false)
  }, [voice.error])

  const handleTouchStart = () => {
    if (disabled || voice.asrUnavailable || holdingRef.current) return
    setFingerDown(true)
    holdingRef.current = true
    touchStartAtRef.current = Date.now()
    finishingRef.current = false
    voice.clearError()
    setPermHint('')

    void (async () => {
      // 权限申请不依赖按住态：松手后也要走完（否则快速点按会静默吞掉授权弹窗）
      const status = await getRecordAuthStatus()

      if (status !== 'granted') {
        setFingerDown(false)
        holdingRef.current = false
        const perm = await ensureRecordPermission({ interactive: true })
        if (!perm.ok) {
          setPermHint(perm.message)
          return
        }
        setPermHint('麦克风已开启，请再次按住说话')
        return
      }

      if (!holdingRef.current) return
      void voice.startListening()
    })()
  }

  const holdActive = fingerDown || voice.isListening
  const holdLabel = voice.asrUnavailable
    ? '请直接输入'
    : holdActive
      ? '松手结束'
      : '按住说话'

  return (
    <View className='record-box'>
      <View className='record-head'>
        <Text className='record-head-title'>{label}</Text>
        <View className='record-status'>
          <Text className='record-status-text'>{status}</Text>
        </View>
      </View>
      {voice.simulatorUnsupported ? (
        <Text className='hint-text'>模拟器不支持语音，请用真机预览或直接在上方输入</Text>
      ) : null}
      <Textarea
        className='record-area'
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        maxlength={MAX_LENGTH}
        onInput={(e) => onChange(e.detail.value)}
      />
      <View className='record-meta'>
        <Text className='record-meta-left'>{metaLeft}</Text>
        <Text className='record-meta-count'>
          {value.length}/{MAX_LENGTH}
        </Text>
      </View>
      {showCharHint && charHint ? (
        <Text className='hint-text'>{charHint}</Text>
      ) : null}
      {prompt ? <View className='light-prompt active'><Text>{prompt}</Text></View> : null}

      <View className={`recording-strip${holdActive ? ' active' : ''}`}>
        <View className='recording-card'>
          <View className='wave'>
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={i} className='wave-bar' />
            ))}
          </View>
          <Text className='recording-text'>{holdActive ? '正在记录' : '准备记录'}</Text>
          <Text className='cancel-hint'>{voice.liveTranscript || '不用停下来整理，顺着讲就好'}</Text>
        </View>
      </View>

      <View className='record-voice-row'>
        <View
          className={`build-hold-button${holdActive ? ' active' : ''}${voice.asrUnavailable ? ' disabled' : ''}`}
          hoverClass='none'
          onTouchStart={handleTouchStart}
          onTouchEnd={finishVoice}
          onTouchCancel={finishVoice}
        >
          <Text className='build-hold-button-text'>{holdLabel}</Text>
        </View>
      </View>

      {permHint ? <Text className='hifi-voice-error'>{permHint}</Text> : null}
      {voice.error ? <Text className='hifi-voice-error'>{voice.error}</Text> : null}
    </View>
  )
}

export { MAX_LENGTH as BUILD_RECORD_MAX_LENGTH }

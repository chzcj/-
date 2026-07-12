import { View, Text, Textarea } from '@tarojs/components'
import { useRef, useEffect } from 'react'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
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
  const pendingStopRef = useRef(false)

  const finishVoice = () => {
    const wasHolding = holdingRef.current
    holdingRef.current = false
    if (!wasHolding && !pendingStopRef.current) return
    if (wasHolding && Date.now() - touchStartAtRef.current < voice.minHoldMs) return
    if (voice.isConnecting) {
      pendingStopRef.current = true
      return
    }
    if (!voice.isListening && !voice.liveTranscript) return
    void voice.stopListening({ fast: true }).then((finalText) => {
      pendingStopRef.current = false
      voice.reset()
      if (finalText) {
        onChange(value ? `${value.trim()}\n${finalText}` : finalText)
        onVoiceText?.(finalText)
      }
    })
  }

  useEffect(() => {
    if (!pendingStopRef.current) return
    if (voice.isConnecting) return
    if (voice.isListening || voice.liveTranscript) finishVoice()
  }, [voice.isConnecting, voice.isListening, voice.liveTranscript])

  const handleTouchStart = () => {
    if (disabled || voice.asrUnavailable || holdingRef.current) return
    holdingRef.current = true
    touchStartAtRef.current = Date.now()
    pendingStopRef.current = false
    voice.clearError()
    void voice.startListening()
  }

  const holdActive = voice.isListening || voice.isConnecting
  const holdLabel = voice.asrUnavailable
    ? '请直接输入'
    : voice.isConnecting
      ? '连接中…'
      : voice.isListening
        ? '松手结束'
        : '按住说话'

  return (
    <View className='record-box'>
      <View className='record-head'>
        <Text className='record-head-title'>{label}</Text>
        <Text className='record-status'>{status}</Text>
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
          <Text className='recording-text'>{voice.isConnecting ? '连接中' : '正在记录'}</Text>
          <Text className='cancel-hint'>{voice.liveTranscript || '不用停下来整理，顺着讲就好'}</Text>
        </View>
      </View>

      <View className='record-voice-row'>
        <View
          className={`build-hold-button${holdActive ? ' active' : ''}${voice.isConnecting ? ' connecting' : ''}${voice.asrUnavailable ? ' disabled' : ''}`}
          hoverClass='none'
          onTouchStart={handleTouchStart}
          onTouchEnd={finishVoice}
          onTouchCancel={finishVoice}
        >
          <Text className='build-hold-button-text'>{holdLabel}</Text>
        </View>
      </View>

      {voice.error ? <Text className='hifi-voice-error'>{voice.error}</Text> : null}
    </View>
  )
}

export { MAX_LENGTH as BUILD_RECORD_MAX_LENGTH }

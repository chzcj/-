import { View, Text, Textarea } from '@tarojs/components'
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
  metaLeft = '系统会先整理，不直接下结论',
  prompt,
  showCharHint = true,
  onChange,
  onVoiceText,
}: BuildRecordBoxProps) {
  const voice = useTencentAsrInput()
  const charCount = value.trim().length
  const charHint = getEntryCaptureCharHint(charCount)

  const handleTouchStart = () => {
    if (disabled || voice.asrUnavailable || voice.isListening) return
    void voice.startListening()
  }

  const handleTouchEnd = () => {
    if (disabled || !voice.isListening) return
    const finalText = voice.stopListening()
    voice.reset()
    if (finalText) {
      onChange(value ? `${value.trim()}\n${finalText}` : finalText)
      onVoiceText?.(finalText)
    }
  }

  return (
    <View className='record-box'>
      <View className='record-head'>
        <Text className='record-head-title'>{label}</Text>
        <Text className='record-status'>{status}</Text>
      </View>
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

      <View className={`recording-strip${voice.isListening ? ' active' : ''}`}>
        <View className='recording-card'>
          <View className='wave'>
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={i} className='wave-bar' />
            ))}
          </View>
          <Text className='recording-text'>正在记录</Text>
          <Text className='cancel-hint'>{voice.liveTranscript || '不用停下来整理，顺着讲就好'}</Text>
        </View>
      </View>

      <View className='record-voice-row'>
        <Text
          className={`chip hold-chip${voice.isListening ? ' active' : ''}${voice.asrUnavailable ? ' disabled' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {voice.asrUnavailable ? '请直接输入' : voice.isListening ? '松手结束' : '按住说话'}
        </Text>
      </View>

      {voice.error ? <Text className='hifi-voice-error'>{voice.error}</Text> : null}
      {!voice.error && voice.liveTranscript && !voice.isListening ? (
        <Text className='hifi-voice-live'>{voice.liveTranscript}</Text>
      ) : null}
    </View>
  )
}

export { MAX_LENGTH as BUILD_RECORD_MAX_LENGTH }

import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Textarea, Button } from '@tarojs/components'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import './index.scss'

type HiFiInputZoneProps = {
  disabled?: boolean
  busy?: boolean
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

  useEffect(() => {
    if (voice.asrUnavailable) setTextMode(true)
  }, [voice.asrUnavailable])

  const voiceDisabled = disabled || voice.asrUnavailable

  const submitText = () => {
    const value = text.trim()
    if (!value || disabled) return
    setText('')
    onSubmit(value, 'text')
  }

  const startVoice = async () => {
    if (voiceDisabled || voice.isListening) return
    await voice.startListening()
  }

  const stopVoice = () => {
    if (!voice.isListening) return
    const finalText = voice.stopListening()
    voice.reset()
    if (finalText) onSubmit(finalText, 'voice')
  }

  const busyHint = busy
    ? queuedCount > 0
      ? `生成中，已排队 ${queuedCount} 条`
      : '生成中…'
    : ''

  return (
    <View className='input-dock-inner'>
      <View className={`recording-panel${voice.isListening ? ' active' : ''}`}>
        <View className='recording-card'>
          <Text className='recording-text'>松手发送</Text>
          <Text className='cancel-hint'>{voice.liveTranscript || '继续按住说话'}</Text>
        </View>
      </View>

      <View className='input-zone'>
        {!textMode ? (
          <View className='input-bar voice-mode'>
            <Button
              className='hold-button'
              disabled={voiceDisabled}
              onTouchStart={() => void startVoice()}
              onTouchEnd={stopVoice}
              onTouchCancel={stopVoice}
            >
              <Text className='hold-button-label'>
                {voice.asrUnavailable ? '语音不可用' : '按住说话'}
              </Text>
            </Button>
            <Button className='mode-button' disabled={disabled} onClick={() => setTextMode(true)}>
              <Text>文</Text>
            </Button>
          </View>
        ) : (
          <View className='input-bar text-mode'>
            <Button className='mode-button' disabled={disabled} onClick={() => setTextMode(false)}>
              <Text>🎤</Text>
            </Button>
            <View className='text-input-wrap'>
              <Textarea
                className='text-input'
                value={text}
                disabled={disabled}
                placeholder={placeholder}
                maxlength={2000}
                autoHeight
                onInput={(e) => setText(e.detail.value)}
                onConfirm={submitText}
              />
            </View>
            <Button className='send-button' disabled={disabled || !text.trim()} onClick={submitText}>
              <Text>→</Text>
            </Button>
          </View>
        )}
        {busyHint ? <Text className='hint-text'>{busyHint}</Text> : null}
        {voice.error ? <Text className='hint-text' style={{ color: '#e54d42' }}>{voice.error}</Text> : null}
      </View>
    </View>
  )
}

import { useEffect, useState } from 'react'
import { View, Text, Textarea } from '@tarojs/components'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import '@/styles/motion.scss'

type VoiceOverlayProps = {
  open: boolean
  title: string
  description: string
  loading?: boolean
  allowEmpty?: boolean
  emptyFinishLabel?: string
  finishLabel?: string
  onCancel: () => void
  onFinish: (text: string) => void
}

export function VoiceOverlay({
  open,
  title,
  description,
  loading = false,
  allowEmpty = false,
  emptyFinishLabel = '先记不太像',
  finishLabel = '结束并更新',
  onCancel,
  onFinish,
}: VoiceOverlayProps) {
  const [text, setText] = useState('')
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  const voice = useTencentAsrInput()

  useEffect(() => {
    if (open) {
      setRendered(true)
      setClosing(false)
      setText('')
      return
    }
    if (rendered) {
      setClosing(true)
      const timer = setTimeout(() => {
        setRendered(false)
        setClosing(false)
      }, 210)
      return () => clearTimeout(timer)
    }
  }, [open, rendered])

  useEffect(() => {
    if (voice.liveTranscript) setText(voice.liveTranscript)
  }, [voice.liveTranscript])

  const toggleVoice = () => {
    if (loading || voice.asrUnavailable) return
    if (voice.isListening) {
      const finalText = voice.stopListening()
      if (finalText) setText(finalText)
      voice.reset()
      return
    }
    void voice.startListening()
  }

  if (!rendered) return null

  const canFinish = allowEmpty || Boolean(text.trim())
  const primaryLabel = text.trim() ? finishLabel : emptyFinishLabel

  return (
    <View
      className={`voice-overlay${open && !closing ? '' : ' is-closing'}`}
      onClick={onCancel}
    >
      <View className='voice-overlay-card' onClick={(e) => e.stopPropagation()}>
        <Text className='section-label'>{title}</Text>
        <Text className='soft-card-body'>{description}</Text>
        <Textarea
          className='deep-expand-note'
          value={text}
          disabled={loading}
          placeholder='可以直接说修正内容，也可以打字。'
          maxlength={500}
          onInput={(e) => setText(e.detail.value)}
        />
        {voice.error ? <Text className='hint-text' style={{ color: '#e54d42' }}>{voice.error}</Text> : null}
        <View className='end-actions' style={{ marginTop: '12px' }}>
          {!voice.asrUnavailable ? (
            <Text
              className={`pill${voice.isListening ? ' primary' : ''}`}
              onClick={toggleVoice}
            >
              {voice.isListening ? '结束录音' : '语音输入'}
            </Text>
          ) : null}
          <Text className='pill' onClick={onCancel}>
            取消
          </Text>
          <Text
            className={`pill primary${!canFinish || loading ? ' disabled' : ''}`}
            onClick={() => {
              if (!canFinish || loading) return
              onFinish(text.trim())
            }}
          >
            {loading ? '提交中…' : primaryLabel}
          </Text>
        </View>
      </View>
    </View>
  )
}

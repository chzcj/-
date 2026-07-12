import { useCallback, useState } from 'react'
import { View, Text, Textarea } from '@tarojs/components'
import { AuthorityInsightCard } from '@/components/hifi/AuthorityInsightCard'
import { VoiceHoldOverlay } from '@/components/voice/VoiceHoldOverlay'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import { apiRequest } from '@/services/api'
import './RehearsalDialogueCapture.scss'

type DialogueSegment = {
  speaker: string
  text: string
  highlight?: boolean
  highlightReason?: string
}

type AnalyzeResult = {
  segments: DialogueSegment[]
  analysis: string
  tryTonight?: string
}

export function RehearsalDialogueCapture() {
  const voice = useTencentAsrInput()
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalyzeResult | null>(null)

  const appendTranscript = useCallback((text: string) => {
    const t = text.trim()
    if (!t) return
    setTranscript((prev) => (prev ? `${prev}\n${t}` : t))
  }, [])

  const startHold = () => {
    if (loading || voice.asrUnavailable || voice.isListening || voice.isConnecting) return
    void voice.startListening()
  }

  const finishHold = () => {
    if (!voice.isListening && !voice.isConnecting) return
    void voice.stopListening({ fast: true }).then((finalText) => {
      appendTranscript(finalText || voice.liveTranscript)
      voice.reset()
    })
  }

  async function analyze() {
    const text = transcript.trim()
    if (!text || loading) return
    setLoading(true)
    setError('')
    const res = await apiRequest<AnalyzeResult>('/api/rehearsal/dialogue-analyze', {
      method: 'POST',
      data: { transcript: text },
    })
    setLoading(false)
    if (!res.ok) {
      setError(res.error.message || '分析暂时没有成功，可以稍后再试。')
      return
    }
    setResult(res.data)
  }

  return (
    <View className='rehearsal-dialogue-section'>
      <VoiceHoldOverlay
        visible={voice.isListening}
        mode='fill'
        transcript={voice.transcript}
        interimTranscript={voice.interimTranscript}
        error={voice.error}
      />

      <Text className='section-label'>记录亲子对话</Text>
      <Text className='hint-text'>
        按住录音转写，或把对话文字粘贴进来；我们会结合孩子画像标出值得留意的句子。
      </Text>

      <View className='soft-card'>
        <Textarea
          className='record-area'
          value={transcript}
          placeholder='转写文字会出现在这里，也可直接粘贴对话记录…'
          maxlength={4000}
          disabled={loading}
          onInput={(e) => setTranscript(e.detail.value)}
        />
        <View className='rehearsal-dialogue-actions'>
          <View
            className={`pill primary hold-pill${voice.isListening || voice.isConnecting ? ' active' : ''}${voice.asrUnavailable ? ' disabled' : ''}`}
            hoverClass='none'
            onTouchStart={startHold}
            onTouchEnd={finishHold}
            onTouchCancel={finishHold}
          >
            <Text>
              {voice.asrUnavailable
                ? '请直接输入'
                : voice.isConnecting
                  ? '连接中…'
                  : voice.isListening
                    ? '松手填入'
                    : '按住录音'}
            </Text>
          </View>
          <Text
            className={`pill${loading || !transcript.trim() ? ' disabled' : ''}`}
            onClick={() => void analyze()}
          >
            {loading ? '分析中…' : '深度解读'}
          </Text>
        </View>
      </View>

      {error ? <Text className='hint-text' style={{ color: '#e54d42' }}>{error}</Text> : null}
      {!voice.isListening && voice.error ? (
        <Text className='hint-text' style={{ color: '#e54d42' }}>{voice.error}</Text>
      ) : null}

      {result ? (
        <View>
          <AuthorityInsightCard title='育见解读' body={result.analysis} />
          {result.tryTonight ? (
            <Text className='hint-text'>今晚可试：{result.tryTonight}</Text>
          ) : null}
          <View className='dialogue-transcript-list'>
            {result.segments.map((seg, i) => (
              <Text
                key={`${i}-${seg.text.slice(0, 12)}`}
                className={seg.highlight ? 'dialogue-highlight' : 'dialogue-line'}
              >
                {seg.speaker}：{seg.text}
                {seg.highlight && seg.highlightReason ? ` — ${seg.highlightReason}` : ''}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

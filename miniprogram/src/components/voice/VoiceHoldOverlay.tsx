import { View, Text } from '@tarojs/components'
import './VoiceHoldOverlay.scss'

export type VoiceHoldMode = 'send' | 'fill'

type VoiceHoldOverlayProps = {
  visible: boolean
  mode: VoiceHoldMode
  transcript: string
  interimTranscript: string
  error?: string
}

export function VoiceHoldOverlay({
  visible,
  mode,
  transcript,
  interimTranscript,
  error,
}: VoiceHoldOverlayProps) {
  if (!visible) return null

  const live = transcript + interimTranscript
  const hint = mode === 'send' ? '松手发送' : '松手填入'

  return (
    <View className='voice-hold-overlay' catchMove>
      <View className='voice-hold-transcript-wrap'>
        {live ? (
          <Text className='voice-hold-transcript'>
            {transcript}
            {interimTranscript ? (
              <Text className='voice-hold-interim'>{interimTranscript}</Text>
            ) : null}
          </Text>
        ) : (
          <Text className='voice-hold-transcript placeholder'>继续说话…</Text>
        )}
      </View>

      <View className='voice-hold-panel'>
        <Text className='voice-hold-hint'>{hint}</Text>
        <View className='voice-hold-wave' aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} className='voice-hold-wave-bar' />
          ))}
        </View>
        {error ? <Text className='voice-hold-error'>{error}</Text> : null}
      </View>
    </View>
  )
}

import { View, Text, ScrollView } from '@tarojs/components'
import './VoiceHoldLiveBanner.scss'

type VoiceHoldLiveBannerProps = {
  visible: boolean
  transcript: string
  interimTranscript: string
  hint: '松手发送' | '松手填入'
  error?: string
}

export function VoiceHoldLiveBanner({
  visible,
  transcript,
  interimTranscript,
  hint,
  error,
}: VoiceHoldLiveBannerProps) {
  if (!visible) return null

  const live = transcript + interimTranscript

  return (
    <View className='voice-hold-live-banner' catchMove={false}>
      <Text className='voice-hold-live-hint'>{hint}</Text>
      <ScrollView scrollY className='voice-hold-live-scroll' showScrollbar={false}>
        {live ? (
          <Text className='voice-hold-live-text'>
            {transcript}
            {interimTranscript ? (
              <Text className='voice-hold-live-interim'>{interimTranscript}</Text>
            ) : null}
          </Text>
        ) : (
          <Text className='voice-hold-live-text placeholder'>继续说话…</Text>
        )}
      </ScrollView>
      {error ? <Text className='voice-hold-live-error'>{error}</Text> : null}
    </View>
  )
}

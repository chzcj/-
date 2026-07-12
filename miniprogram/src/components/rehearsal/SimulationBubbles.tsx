import { View, Text } from '@tarojs/components'
import { getChildDisplayName } from '@/services/childStorage'

export function SimulationParentBubble({ text }: { text: string }) {
  return (
    <View className='message-row user'>
      <View className='bubble'>
        <Text>{text}</Text>
      </View>
    </View>
  )
}

export function SimulationSystemHintBubble({ text }: { text: string }) {
  return (
    <View className='message-row ai'>
      <View className='bubble'>
        <Text className='muted'>{text}</Text>
      </View>
    </View>
  )
}

type SecondMeProps = {
  childText: string
  hintTitle: string
  hintText: string
  suggestedTitle?: string
  suggestedText?: string
}

export function SimulationSecondMeBubble({
  childText,
  hintTitle,
  hintText,
  suggestedTitle,
  suggestedText,
}: SecondMeProps) {
  const childName = getChildDisplayName()
  return (
    <View className='message-row ai'>
      <View className='bubble'>
        <View className='bubble-section'>
          <Text className='section-label'>{childName} SecondMe</Text>
          <Text className='bubble-reply'>{childText}</Text>
        </View>
        <View className='bubble-section'>
          <Text className='section-label'>{hintTitle}</Text>
          <Text className='section-body'>{hintText}</Text>
        </View>
        {suggestedText ? (
          <View className='bubble-section'>
            <Text className='section-label'>{suggestedTitle || '您可以这样说'}</Text>
            <Text className='section-body'>{suggestedText}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export function SimulationThinkingBubble() {
  return (
    <View className='message-row ai'>
      <View className='bubble thinking-bubble'>
        <View className='thinking-dots'>
          <View className='thinking-dots-dot' />
          <View className='thinking-dots-dot' />
          <View className='thinking-dots-dot' />
        </View>
      </View>
    </View>
  )
}

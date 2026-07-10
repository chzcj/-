import { View, Text } from '@tarojs/components'

export function DailyParentBubble({ text }: { text: string }) {
  return (
    <View className='message-row user'>
      <View className='bubble'>
        <Text>{text}</Text>
      </View>
    </View>
  )
}

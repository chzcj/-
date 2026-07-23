import { View, Text } from '@tarojs/components'
import { getChildDisplayName } from '@/services/childStorage'
import { RehearsalAnimatedEllipsis } from '@/components/rehearsal/RehearsalAnimatedEllipsis'

function childAvatarLabel(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '孩'
  return trimmed.slice(-1)
}

export function SimulationParentBubble({ text }: { text: string }) {
  return (
    <View className='rehearsal-msg rehearsal-msg--parent'>
      <View className='rehearsal-msg-col'>
        <View className='rehearsal-bubble rehearsal-bubble--parent'>
          <Text className='rehearsal-bubble-text'>{text}</Text>
        </View>
      </View>
      <View className='rehearsal-avatar rehearsal-avatar--parent'>
        <Text>我</Text>
      </View>
    </View>
  )
}

export function SimulationSystemHintBubble({ text }: { text: string }) {
  return (
    <View className='rehearsal-system-hint'>
      <Text className='rehearsal-system-hint-text'>{text}</Text>
    </View>
  )
}

type SecondMeProps = {
  childText: string
  hintTitle: string
  hintText: string
  hintPending?: boolean
  suggestedTitle?: string
  suggestedText?: string
}

function isHintPlaceholder(text: string): boolean {
  const t = text.trim()
  return t === '…' || t === '...' || t === '。。。' || t === '……' || /^[.…]{2,}$/.test(t)
}

export function SimulationSecondMeBubble({
  childText,
  hintTitle,
  hintText,
  hintPending = false,
  suggestedTitle,
  suggestedText,
}: SecondMeProps) {
  const childName = getChildDisplayName()
  const avatarLabel = childAvatarLabel(childName)
  const showBubbleLoading = !childText.trim()
  const showHintLoading = hintPending || isHintPlaceholder(hintText)

  return (
    <View className='rehearsal-msg rehearsal-msg--child'>
      <View className='rehearsal-avatar'>
        <Text>{avatarLabel}</Text>
      </View>
      <View className='rehearsal-msg-col'>
        <View className='rehearsal-child-stack'>
          <View className='rehearsal-bubble rehearsal-bubble--child'>
            {showBubbleLoading ? (
              <RehearsalAnimatedEllipsis variant='bubble' />
            ) : (
              <Text className='rehearsal-bubble-text'>{childText}</Text>
            )}
          </View>
          {(showHintLoading || hintText) ? (
            <View className='rehearsal-child-insight'>
              <Text className='rehearsal-child-insight-label'>{hintTitle}</Text>
              {showHintLoading ? (
                <RehearsalAnimatedEllipsis variant='insight' />
              ) : (
                <Text className='rehearsal-child-insight-body'>{hintText}</Text>
              )}
            </View>
          ) : null}
          {suggestedText ? (
            <View className='rehearsal-child-insight rehearsal-child-insight--suggest'>
              <Text className='rehearsal-child-insight-label'>{suggestedTitle || '您可以这样说'}</Text>
              <Text className='rehearsal-child-insight-body'>{suggestedText}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

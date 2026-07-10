import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import type { DailyAction, DailySection, DailyThinkingChip } from '@yujian/contracts'
import { saveTask } from '@/services/taskStorage'
import { DailyThinkingPanel } from './DailyThinkingPanel'
import { DailySectionView } from './DailySectionView'

type ThinkingChip = DailyThinkingChip

const MEMORY_LABEL_TEXT: Record<string, string> = {
  remembered: '已记住',
  organizing: '正在整理记忆…',
  in对话: '这次先记在对话里',
  failed: '记忆整理失败，稍后会重试',
}

const TASK_TITLE_BANNED = /模式能对上|标记为|观察记录|当前输入可被已有画像解释|写入记忆/i

function pickTaskTitle(text: string, sections?: DailySection[], taskTitle?: string): string {
  if (taskTitle && taskTitle.trim().length >= 6 && !TASK_TITLE_BANNED.test(taskTitle)) {
    return taskTitle.trim().slice(0, 48)
  }
  const advice = sections?.find((s) => s.id === 'advice')
  const fromAdvice = advice?.paragraphs?.find((p) => p.trim().length > 8)?.trim()
  if (fromAdvice) return fromAdvice.slice(0, 48)

  const sentence = text.split(/[。！？\n]/).find((s) => s.trim().length > 4)?.trim()
  if (sentence && !TASK_TITLE_BANNED.test(sentence)) return sentence.slice(0, 48)

  const fallback = text.replace(TASK_TITLE_BANNED, '').trim()
  return (fallback || '今晚先这样试').slice(0, 48)
}

type DailyAiMessageProps = {
  text: string
  traceId?: string
  sections?: DailySection[]
  actions?: DailyAction[]
  streaming?: boolean
  thinkingChips?: ThinkingChip[]
  showThinking?: boolean
  showActions?: boolean
  sectionErrors?: string[]
  memoryLabel?: string
  interrupted?: boolean
  proseComplete?: boolean
  sectionsComplete?: boolean
  onRetrySection?: (sectionId: string) => void
  onDeepExpand?: () => void
  onFollowUpText?: (seed: string) => void
}

export function DailyAiMessage({
  text,
  traceId,
  sections,
  actions,
  streaming,
  thinkingChips,
  showThinking,
  showActions = true,
  sectionErrors,
  memoryLabel,
  interrupted,
  onRetrySection,
  onDeepExpand,
  onFollowUpText,
}: DailyAiMessageProps) {
  const [taskSaved, setTaskSaved] = useState(false)
  const showPanel = showThinking && thinkingChips?.length
  const memoryText = memoryLabel ? MEMORY_LABEL_TEXT[memoryLabel] || memoryLabel : ''

  return (
    <View className='message-row ai'>
      <View className='bubble'>
        {showPanel ? <DailyThinkingPanel chips={thinkingChips!} /> : null}
        {memoryText ? <Text className='muted'>{memoryText}</Text> : null}
        {interrupted ? <Text className='hint-text'>已停止生成，上文保留。</Text> : null}
        {text || streaming ? (
          <Text className='bubble-reply'>{text || (streaming ? '…' : '')}</Text>
        ) : null}
        {(sections || [])
          .filter((s) => !s.hidden)
          .map((section) => (
            <DailySectionView
              key={section.id}
              section={section}
              hasError={sectionErrors?.includes(section.id)}
              onRetry={onRetrySection ? () => onRetrySection(section.id) : undefined}
            />
          ))}
        {showActions && actions?.length ? (
          <View className='end-actions'>
            {actions.map((action) => {
              const label =
                action.kind === 'task' && taskSaved ? '已保存到任务' : action.label
              const disabled = action.kind === 'task' && taskSaved
              return (
                <Text
                  key={action.id}
                  className={`pill${disabled ? ' disabled' : ''}`}
                  onClick={() => {
                    if (disabled) return
                    if (action.kind === 'expand_sections') onDeepExpand?.()
                    else if (action.kind === 'task') {
                      const title = pickTaskTitle(
                        text,
                        sections,
                        action.payload?.taskTitle
                      )
                      void saveTask(title, '来自交流', traceId).then((ok) => {
                        if (ok) setTaskSaved(true)
                      })
                    } else if (action.kind === 'rehearsal') {
                      const seed = action.payload?.seedText || text.slice(0, 12)
                      try {
                        Taro.setStorageSync('childos_rehearsal_scene_seed', seed)
                      } catch {
                        /* ignore */
                      }
                      void Taro.switchTab({ url: '/pages/rehearsal/index' })
                    } else if (action.kind === 'how_to_speak') {
                      const q = traceId ? `?traceId=${encodeURIComponent(traceId)}` : ''
                      void Taro.navigateTo({ url: `/pages/daily/how-to-speak/index${q}` })
                    } else if (action.payload?.seedText) {
                      onFollowUpText?.(action.payload.seedText)
                    }
                  }}
                >
                  {label}
                </Text>
              )
            })}
          </View>
        ) : null}
      </View>
    </View>
  )
}

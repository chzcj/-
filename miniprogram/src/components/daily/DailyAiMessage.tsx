import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import type { DailyAction, DailySection, DailyThinkingChip } from '@yujian/contracts'
import { saveTask } from '@/services/taskStorage'
import { normalizeTaskTitle, stripParentFacingMarkdown } from '@/lib/textDisplay'
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

/**
 * 计划定案 B：优先 AI taskTitle；否则从 advice 抽 6–24 字祈使句；
 * 禁止用 prose 叙事首句；最终 fallback「今晚先试一次小步骤」。
 */
function pickTaskTitle(text: string, sections?: DailySection[], taskTitle?: string): string {
  if (taskTitle && taskTitle.trim().length >= 4 && !TASK_TITLE_BANNED.test(taskTitle)) {
    return normalizeTaskTitle(taskTitle, '今晚先试一次小步骤')
  }
  const advice = sections?.find((s) => s.id === 'advice')
  const fromAdvice = advice?.paragraphs?.find((p) => p.trim().length > 6)?.trim()
  if (fromAdvice && !TASK_TITLE_BANNED.test(fromAdvice)) {
    return normalizeTaskTitle(fromAdvice, '今晚先试一次小步骤')
  }
  const fromItems = advice?.items?.find((p) => p.trim().length > 4)?.trim()
  if (fromItems && !TASK_TITLE_BANNED.test(fromItems)) {
    return normalizeTaskTitle(fromItems, '今晚先试一次小步骤')
  }
  void text
  return '今晚先试一次小步骤'
}

function taskSceneSubtitle(action: DailyAction, source = '来自交流'): string {
  const seed = action.payload?.seedText?.trim()
  if (seed && seed.length >= 4) {
    const short = seed.replace(/\s+/g, ' ').slice(0, 28)
    return `${source} · ${short}${seed.length > 28 ? '…' : ''}`
  }
  return source
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
  animatingSectionId?: string | null
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
  sectionsComplete,
  onRetrySection,
  onDeepExpand,
  onFollowUpText,
  animatingSectionId,
}: DailyAiMessageProps) {
  const [taskSaved, setTaskSaved] = useState(false)
  const showPanel = showThinking && thinkingChips?.length
  const memoryText = memoryLabel ? MEMORY_LABEL_TEXT[memoryLabel] || memoryLabel : ''
  const actionsReady = sectionsComplete ?? !streaming
  const primaryKinds = new Set(['task', 'rehearsal', 'how_to_speak', 'expand_sections'])
  const displayText = stripParentFacingMarkdown(text)

  return (
    <View className='message-row ai'>
      <View className='bubble'>
        {showPanel ? <DailyThinkingPanel chips={thinkingChips!} /> : null}
        {memoryText ? <Text className='muted'>{memoryText}</Text> : null}
        {interrupted ? <Text className='hint-text'>已停止生成，上文保留。</Text> : null}
        {displayText || streaming ? (
          <Text className='bubble-reply'>{displayText || (streaming ? '…' : '')}</Text>
        ) : null}
        {(sections || [])
          .filter((s) => !s.hidden)
          .map((section) => (
            <DailySectionView
              key={section.id}
              section={section}
              hasError={sectionErrors?.includes(section.id)}
              animate={section.id === animatingSectionId}
              onRetry={onRetrySection ? () => onRetrySection(section.id) : undefined}
            />
          ))}
        {showActions && actionsReady && actions?.length ? (
          <View className='end-actions'>
            {actions.map((action) => {
              const label =
                action.kind === 'task' && taskSaved ? '已保存到任务' : action.label
              const disabled = action.kind === 'task' && taskSaved
              const isPrimary = primaryKinds.has(action.kind)
              return (
                <Text
                  key={action.id}
                  className={`pill${isPrimary ? ' primary' : ''}${disabled ? ' disabled' : ''}`}
                  onClick={() => {
                    if (disabled) return
                    if (action.kind === 'expand_sections') onDeepExpand?.()
                    else if (action.kind === 'task') {
                      const title = pickTaskTitle(text, sections, action.payload?.taskTitle)
                      const scene = taskSceneSubtitle(action, '来自交流')
                      void saveTask(title, '来自交流', traceId, {
                        observation: scene,
                        replyExcerpt: text.slice(0, 600),
                      }).then((ok) => {
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

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DailyAction, DailySection, DailyThinkingChip } from '@/types/daily-message'
import type { DailyCards } from '@/types/database'
import { saveTask } from '@/lib/storage/taskStorage'
import { DailyBubbleShell } from '@/components/daily/DailyBubbleShell'
import { composeLegacySectionsFromCards } from '@/lib/daily/legacy-sections'
import { stashDailyDeepSections } from '@/lib/daily/dailyThreadUtils'

const TASK_TITLE_BANNED = /模式能对上|标记为|观察记录|当前输入可被已有画像解释|写入记忆/i

function pickTaskTitle(text: string, sections?: DailySection[], taskTitle?: string): string {
  // 优先用 BFF 同次 LLM 提炼的 taskTitle（祈使句式任务标题），避免截原话。
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

const REVEAL_INTERVAL_MS = 160

export function DailyParentBubble({ text }: { text: string }) {
  return (
    <div className="message-row user">
      <div className="bubble">{text}</div>
    </div>
  )
}

type DailyAiMessageProps = {
  text: string
  traceId?: string
  sections?: DailySection[]
  actions?: DailyAction[]
  cards?: DailyCards
  streaming?: boolean
  thinkingChips?: DailyThinkingChip[]
  showThinking?: boolean
  showActions?: boolean
  animateSections?: boolean
  onFollowUpText?: (seed: string) => void
}

export function DailyAiMessage({
  text,
  traceId,
  sections: sectionsProp,
  actions: actionsProp,
  cards,
  streaming,
  thinkingChips,
  showThinking,
  showActions = true,
  animateSections = true,
  onFollowUpText,
}: DailyAiMessageProps) {
  const router = useRouter()
  const [taskSaved, setTaskSaved] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set())
  const [animatingId, setAnimatingId] = useState<string | null>(null)

  const sections = useMemo(() => {
    if (sectionsProp?.length) return sectionsProp
    return composeLegacySectionsFromCards(cards)
  }, [sectionsProp, cards])

  const actions = actionsProp?.length ? actionsProp : []

  const visibleSectionOrder = useMemo(
    () => sections.filter((s) => !s.hidden || expandedIds.has(s.id)).map((s) => s.id),
    [sections, expandedIds]
  )

  const sectionRevealKey = visibleSectionOrder.join('|')

  useEffect(() => {
    if (streaming) {
      setRevealedIds(new Set())
      setAnimatingId(null)
      return
    }
    if (!animateSections || visibleSectionOrder.length === 0) {
      setRevealedIds(new Set(visibleSectionOrder))
      setAnimatingId(null)
      return
    }

    setRevealedIds(new Set())
    setAnimatingId(null)
    let i = 0
    const timer = window.setInterval(() => {
      if (i >= visibleSectionOrder.length) {
        window.clearInterval(timer)
        setAnimatingId(null)
        return
      }
      const id = visibleSectionOrder[i]
      i += 1
      setAnimatingId(id)
      setRevealedIds((prev) => new Set([...prev, id]))
    }, REVEAL_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [streaming, animateSections, sectionRevealKey, visibleSectionOrder])

  const handleAction = useCallback(
    (action: DailyAction) => {
      switch (action.kind) {
        case 'expand_sections': {
          const ids = action.payload?.sectionIds || []
          const deepSections = sections.filter((s) => ids.includes(s.id) || s.hidden)
          stashDailyDeepSections(deepSections, text, traceId)
          router.push('/understanding-card?source=daily')
          break
        }
        case 'rehearsal': {
          const seed = action.payload?.seedText || text.slice(0, 12)
          try {
            sessionStorage.setItem('childos_rehearsal_scene_seed', seed)
          } catch {
            /* ignore */
          }
          router.push('/rehearsal')
          break
        }
        case 'task': {
          if (taskSaved) return
          const title = pickTaskTitle(
            action.payload?.seedText || text,
            sections,
            action.payload?.taskTitle as string | undefined
          )
          void saveTask(title, '来自交流', traceId)
          setTaskSaved(true)
          break
        }
        case 'follow_up_text': {
          if (action.payload?.seedText && onFollowUpText) {
            onFollowUpText(action.payload.seedText)
          }
          break
        }
        case 'navigate': {
          if (action.payload?.route) {
            if (action.payload.stashDeep) {
              const ids = action.payload.sectionIds || []
              const deepSections = sections.filter((s) => ids.includes(s.id) || s.hidden)
              stashDailyDeepSections(deepSections, text, traceId)
            }
            router.push(action.payload.route)
          }
          break
        }
        default:
          break
      }
    },
    [onFollowUpText, router, sections, taskSaved, text, traceId]
  )

  const showActionStrip = showActions && !streaming && actions.length > 0

  return (
    <DailyBubbleShell
      prose={text}
      sections={sections}
      streaming={streaming}
      thinkingChips={thinkingChips}
      showThinking={showThinking}
      revealedIds={revealedIds}
      expandedIds={expandedIds}
      animateSections={animateSections}
      animatingId={animatingId}
      actions={
        showActionStrip ? (
          <div className="suggestion-strip">
            {actions.map((action) => {
              const label = action.kind === 'task' && taskSaved ? '已保存到任务' : action.label
              return (
                <button
                  key={action.id}
                  type="button"
                  className={action.primary ? 'pill primary' : 'pill'}
                  disabled={action.kind === 'task' && taskSaved}
                  onClick={() => handleAction(action)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : null
      }
    />
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const REVEAL_INTERVAL_MS = 70

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
  sectionsComplete?: boolean
  thinkingChips?: DailyThinkingChip[]
  showThinking?: boolean
  showActions?: boolean
  animateSections?: boolean
  proseComplete?: boolean
  sectionErrors?: string[]
  interrupted?: boolean
  /** 家长可见的「这轮记住了没」文案（已记住/这次先记在对话里…），来自 memory_ledger */
  memoryLabel?: string
  onRetrySection?: (sectionId: string) => void
  onDeepExpand?: () => void
  onFollowUpText?: (seed: string) => void
}

const MEMORY_LABEL_TEXT: Record<string, string> = {
  remembered: '已记住',
  organizing: '正在整理记忆…',
  'in对话': '这次先记在对话里',
  failed: '记忆整理失败，稍后会重试',
  unknown: '',
}

export function DailyAiMessage({
  text,
  traceId,
  sections: sectionsProp,
  actions: actionsProp,
  cards,
  streaming,
  sectionsComplete = true,
  proseComplete = true,
  sectionErrors,
  interrupted,
  thinkingChips,
  showThinking,
  showActions = true,
  animateSections = true,
  memoryLabel,
  onFollowUpText,
  onRetrySection,
  onDeepExpand,
}: DailyAiMessageProps) {
  const router = useRouter()
  const [taskSaved, setTaskSaved] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set())
  const [animatingId, setAnimatingId] = useState<string | null>(null)
  const revealTimerRef = useRef<number | undefined>()

  const sections = useMemo(() => {
    if (sectionsProp?.length) return sectionsProp
    return composeLegacySectionsFromCards(cards)
  }, [sectionsProp, cards])

  const actions = actionsProp?.length ? actionsProp : []

  const visibleSectionOrder = useMemo(
    () =>
      sections
        .filter((s) => !s.hidden || expandedIds.has(s.id))
        .filter((s) => s.streamingText !== undefined || s.paragraphs?.length || s.items?.length || s.quotes?.length)
        .map((s) => s.id),
    [sections, expandedIds]
  )

  const sectionRevealKey = visibleSectionOrder.join('|')

  useEffect(() => {
    // sections 早到时（streaming 仍为 true）也要逐张揭示，让家长尽快看到要点。
    if (revealTimerRef.current) {
      window.clearInterval(revealTimerRef.current)
      revealTimerRef.current = undefined
    }
    if (visibleSectionOrder.length === 0) {
      setRevealedIds(new Set())
      setAnimatingId(null)
      return
    }
    if (!animateSections || sections.some((s) => s.streamingText !== undefined)) {
      setRevealedIds(new Set(visibleSectionOrder))
      setAnimatingId(null)
      return
    }

    // 只对"新出现"的 section 做揭示动画，已揭示的保留，避免流式增量重置。
    setRevealedIds((prev) => {
      const newIds = visibleSectionOrder.filter((id) => !prev.has(id))
      if (newIds.length === 0) return prev
      let i = 0
      revealTimerRef.current = window.setInterval(() => {
        if (i >= newIds.length) {
          if (revealTimerRef.current) {
            window.clearInterval(revealTimerRef.current)
            revealTimerRef.current = undefined
          }
          setAnimatingId(null)
          return
        }
        const id = newIds[i]
        i += 1
        setAnimatingId(id)
        setRevealedIds((cur) => new Set([...cur, id]))
      }, REVEAL_INTERVAL_MS)
      return prev
    })
  }, [animateSections, sectionRevealKey, visibleSectionOrder])

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        window.clearInterval(revealTimerRef.current)
        revealTimerRef.current = undefined
      }
    }
  }, [])

  const handleAction = useCallback(
    (action: DailyAction) => {
      switch (action.kind) {
        case 'expand_sections': {
          const ids = action.payload?.sectionIds || []
          const deepSections = sections.filter((s) => ids.includes(s.id) || s.hidden)
          stashDailyDeepSections(deepSections, text, traceId)
          if (onDeepExpand) {
            onDeepExpand()
          } else {
            router.push('/understanding-card?source=daily')
          }
          break
        }
        case 'how_to_speak': {
          const q = traceId ? `?traceId=${encodeURIComponent(traceId)}` : ''
          router.push(`/daily/how-to-speak${q}`)
          break
        }
        case 'rehearsal': {
          const seed = action.payload?.seedText || text.slice(0, 200)
          const sceneId = action.payload?.sceneId || 'homework_start'
          try {
            sessionStorage.setItem(
              'childos_rehearsal_handoff',
              JSON.stringify({
                sceneId,
                seedText: seed,
                parentText: text.slice(0, 800),
                traceId: traceId || '',
              })
            )
            sessionStorage.setItem('childos_rehearsal_scene_seed', seed.slice(0, 80))
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
          void saveTask(title, '来自交流', traceId, {
            observation: (action.payload?.seedText as string | undefined)?.slice(0, 80),
            replyExcerpt: text.slice(0, 600),
          })
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
    [onDeepExpand, onFollowUpText, router, sections, taskSaved, text, traceId]
  )

  const sectionErrorSet = useMemo(() => new Set(sectionErrors || []), [sectionErrors])

  const showActionStrip = showActions && sectionsComplete && actions.length > 0
  const memoryLabelText = memoryLabel ? MEMORY_LABEL_TEXT[memoryLabel] || '' : ''

  return (
    <>
      <DailyBubbleShell
        prose={text}
        sections={sections}
        streaming={streaming}
        proseComplete={proseComplete}
        thinkingChips={thinkingChips}
        showThinking={showThinking}
        revealedIds={revealedIds}
        expandedIds={expandedIds}
        animateSections={animateSections}
        animatingId={animatingId}
        sectionErrors={sectionErrorSet}
        onRetrySection={onRetrySection}
        interrupted={interrupted}
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
      {memoryLabelText && !streaming ? (
        <div className="memory-label-tag" data-label={memoryLabel}>{memoryLabelText}</div>
      ) : null}
    </>
  )
}

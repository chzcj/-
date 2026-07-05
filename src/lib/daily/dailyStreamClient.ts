'use client'

import type { DailyCards } from '@/types/database'
import type { DailyAction, DailySection, DailyThinkingChip } from '@/types/daily-message'
import type { DailyStreamEvent } from '@/types/daily-stream'

const DAILY_THREAD_KEY = 'childos_daily_thread_v1'
const DAILY_PENDING_KEY = 'childos_daily_pending'

export type DailyTurn = {
  role: 'parent' | 'ai'
  text: string
  traceId?: string
  cards?: DailyCards
  linkedAreas?: string[]
  sections?: DailySection[]
  actions?: DailyAction[]
  /** 流式进行中：true 时该 turn 仍在更新（正文/section/action 任一未就绪） */
  streaming?: boolean
  /** 可见 section 已全部流式结束，可展示 actions（3A） */
  sectionsComplete?: boolean
  /** 深度展开卡片已插入线程（1B） */
  deepExpanded?: boolean
  /** 正文流式已结束，可开始展示 section */
  proseComplete?: boolean
  /** 用户打断本轮输出 */
  interrupted?: boolean
  /** section 生成失败的 id 集合 */
  sectionErrors?: string[]
  thinkingChips?: DailyThinkingChip[]
  showThinking?: boolean
  /** 家长可见「这轮记住了没」标签（来自 memory_ledger / job_queue trace 查询） */
  memoryLabel?: string
}

export function loadDailyThread(): DailyTurn[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(DAILY_THREAD_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DailyTurn[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveDailyThread(turns: DailyTurn[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(DAILY_THREAD_KEY, JSON.stringify(turns.slice(-30)))
  } catch {
    /* ignore */
  }
}

export function peekDailyPending(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(DAILY_PENDING_KEY)
    if (!raw) return null
    const pending = JSON.parse(raw) as { text?: string }
    return pending.text?.trim() || null
  } catch {
    return null
  }
}

export function clearDailyPending() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(DAILY_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

type StreamEvent = DailyStreamEvent

export type SectionStreamHandlers = {
  onSectionStart?: (section: DailySection) => void
  onSectionDelta?: (id: string, text: string) => void
  onSectionComplete?: (section: DailySection) => void
  onSectionError?: (id: string, message?: string) => void
  onSectionsComplete?: (sections: DailySection[]) => void
  onProseComplete?: () => void
}

export type DailyStreamResult = {
  acc: string
  /** final 事件中的去重后正文（落库用）；展示以 acc 流式累积为准，避免缩字闪烁 */
  finalText?: string
  traceId?: string
  finalCards?: DailyCards
  finalSections?: DailySection[]
  finalActions?: DailyAction[]
  finalLinked?: string[]
  thinkingChips?: DailyThinkingChip[]
  earlySections?: DailySection[]
  earlyActions?: DailyAction[]
  pendingSectionStart?: DailySection
  pendingSectionDelta?: { id: string; text: string }
  pendingSectionComplete?: DailySection
  pendingSectionsComplete?: DailySection[]
  pendingProseComplete?: boolean
  pendingSectionError?: { id: string; message?: string }
  streamError?: string
  httpError?: string
}

export function parseDailyStreamLine(line: string, state: DailyStreamResult) {
  if (!line.trim()) return
  try {
    const evt = JSON.parse(line) as StreamEvent
    if (evt.type === 'delta' && evt.delta) {
      state.acc += evt.delta
    } else if (evt.type === 'thinking' && Array.isArray(evt.chips)) {
      state.thinkingChips = evt.chips
    } else if (evt.type === 'start' && evt.traceId) {
      state.traceId = evt.traceId
    } else if (evt.type === 'prose_complete') {
      state.pendingProseComplete = true
    } else if (evt.type === 'section_error' && evt.id) {
      state.pendingSectionError = { id: evt.id, message: evt.message }
    } else if (evt.type === 'section_start' && evt.section) {
      state.pendingSectionStart = evt.section
    } else if (evt.type === 'section_delta' && evt.id && typeof evt.text === 'string') {
      state.pendingSectionDelta = { id: evt.id, text: evt.text }
    } else if (evt.type === 'section_complete' && evt.section) {
      state.pendingSectionComplete = evt.section
    } else if (evt.type === 'sections_complete' && Array.isArray(evt.sections)) {
      state.pendingSectionsComplete = evt.sections
    } else if (evt.type === 'sections' && Array.isArray(evt.sections)) {
      state.earlySections = evt.sections
    } else if (evt.type === 'actions' && Array.isArray(evt.actions)) {
      state.earlyActions = evt.actions
    } else if (evt.type === 'final') {
      if (evt.text) state.finalText = evt.text
      if (evt.cards && typeof evt.cards === 'object') state.finalCards = evt.cards
      if (Array.isArray(evt.sections)) state.finalSections = evt.sections
      if (Array.isArray(evt.actions)) state.finalActions = evt.actions
      if (Array.isArray(evt.linkedAreas)) state.finalLinked = evt.linkedAreas
    } else if (evt.type === 'error') {
      state.streamError = evt.message || '这次没有整理成功，可以再试一次。'
    }
  } catch {
    /* skip malformed line */
  }
}

export async function readDailyStream(
  res: Response,
  onDelta: (text: string) => void,
  onThinking?: (chips: DailyThinkingChip[]) => void,
  onSections?: (sections: DailySection[]) => void,
  onActions?: (actions: DailyAction[]) => void,
  onStart?: (traceId: string) => void,
  sectionHandlers?: SectionStreamHandlers,
  onSectionsComplete?: (sections: DailySection[]) => void,
  signal?: AbortSignal
): Promise<DailyStreamResult> {
  const state: DailyStreamResult = { acc: '' }

  if (!res.ok) {
    try {
      const json = (await res.json()) as { error?: { message?: string } }
      return { ...state, httpError: json.error?.message || '这次没有整理成功，可以再试一次。' }
    } catch {
      return { ...state, httpError: '这次没有整理成功，可以再试一次。' }
    }
  }

  if (!res.body) return state

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastSections: DailySection[] | undefined
  let lastActions: DailyAction[] | undefined
  let startFired = false

  const flushPending = () => {
    if (state.pendingSectionStart && sectionHandlers?.onSectionStart) {
      sectionHandlers.onSectionStart(state.pendingSectionStart)
      state.pendingSectionStart = undefined
    }
    if (state.pendingSectionDelta && sectionHandlers?.onSectionDelta) {
      sectionHandlers.onSectionDelta(state.pendingSectionDelta.id, state.pendingSectionDelta.text)
      state.pendingSectionDelta = undefined
    }
    if (state.pendingSectionComplete && sectionHandlers?.onSectionComplete) {
      sectionHandlers.onSectionComplete(state.pendingSectionComplete)
      state.pendingSectionComplete = undefined
    }
    if (state.pendingSectionError && sectionHandlers?.onSectionError) {
      sectionHandlers.onSectionError(state.pendingSectionError.id, state.pendingSectionError.message)
      state.pendingSectionError = undefined
    }
    if (state.pendingProseComplete) {
      sectionHandlers?.onProseComplete?.()
      state.pendingProseComplete = undefined
    }
    if (state.pendingSectionsComplete) {
      sectionHandlers?.onSectionsComplete?.(state.pendingSectionsComplete)
      onSectionsComplete?.(state.pendingSectionsComplete)
      state.pendingSectionsComplete = undefined
    }
  }

  const processLine = (line: string) => {
    const prevThinking = state.thinkingChips
    parseDailyStreamLine(line, state)
    if (state.traceId && !startFired && onStart) {
      startFired = true
      onStart(state.traceId)
    }
    if (state.acc) onDelta(state.acc)
    if (state.thinkingChips && state.thinkingChips !== prevThinking && onThinking) {
      onThinking(state.thinkingChips)
    }
    flushPending()
    if (state.earlySections && state.earlySections !== lastSections && onSections) {
      lastSections = state.earlySections
      onSections(state.earlySections)
    }
    if (state.earlyActions && state.earlyActions !== lastActions && onActions) {
      lastActions = state.earlyActions
      onActions(state.earlyActions)
    }
  }

  try {
    while (true) {
      if (signal?.aborted) {
        try {
          await reader.cancel()
        } catch {
          /* ignore */
        }
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        processLine(line)
      }
    }

    if (buffer.trim() && !signal?.aborted) {
      processLine(buffer)
    }
  } catch (err) {
    if (signal?.aborted) {
      return { ...state, streamError: undefined }
    }
    throw err
  }

  return state
}

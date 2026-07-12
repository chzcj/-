import type { DailyAction, DailySection, DailyThinkingChip } from './daily-message'

export interface DailyCards {
  judgmentDelta?: string
  understandingCard?: { tier: '初版' | '标准' | '深度'; reading: string }
  evidenceBasis?: string
  followUp?: { question: string; distinction?: string }
  deepAnalysis?: { title: string; points: string[] }
  confidenceMode?: 'high' | 'low'
  adviceSeed?: string
  sections?: DailySection[]
}

export type DailyStreamEvent =
  | { type: 'start'; traceId: string }
  | { type: 'thinking'; chips: DailyThinkingChip[] }
  | { type: 'delta'; delta: string }
  | { type: 'prose_complete' }
  | { type: 'section_start'; section: DailySection }
  | { type: 'section_delta'; id: string; text: string }
  | { type: 'section_complete'; section: DailySection }
  | { type: 'section_error'; id: string; message: string }
  | { type: 'sections_complete'; sections: DailySection[] }
  | { type: 'sections'; sections: DailySection[] }
  | { type: 'actions'; actions: DailyAction[] }
  | {
      type: 'final'
      text: string
      sections: DailySection[]
      actions: DailyAction[]
      linkedAreas?: string[]
      cards?: DailyCards
      traceId: string
      runtime?: unknown
      timing?: unknown
    }
  | { type: 'error'; code: string; message: string }

export type DailyTurnState =
  | 'created'
  | 'streaming_prose'
  | 'prose_complete'
  | 'streaming_sections'
  | 'sections_complete'
  | 'actions_ready'
  | 'final'

export interface DailyStreamRequest {
  text: string
  warmTurn?: boolean
  recentSectionIds?: string[]
  maturityLevel?: string
}

export function parseDailyStreamEvent(line: string): DailyStreamEvent | null {
  if (!line.trim()) return null
  try {
    return JSON.parse(line) as DailyStreamEvent
  } catch {
    return null
  }
}

export type DailyStreamResult = {
  acc: string
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
    const evt = JSON.parse(line) as DailyStreamEvent
    if (evt.type === 'delta' && evt.delta) {
      const d = evt.delta
      if (d.startsWith(state.acc) && d.length >= state.acc.length) {
        // 服务端下发累计全文：赋值而非再累加，避免梯形重复
        state.acc = d
      } else if (state.acc.startsWith(d) && d.length < state.acc.length) {
        // 异常回退/重放更短片段：忽略
      } else {
        state.acc += d
      }
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

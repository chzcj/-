/**
 * Daily 流式前后端共享契约类型。
 * 后端 emitter（app/api/daily/stream/route.ts）与前端 parser（src/lib/daily/dailyStreamClient.ts）
 * 必须共用本文件类型，禁止各写各的松散 shape。新增事件类型必须同步改这里 + 前后端，否则 TS 报错。
 */

import type { DailyCards } from '@/types/database'
import type { DailyAction, DailySection, DailyThinkingChip } from '@/types/daily-message'

/** 一轮交流 BFF → 前端的 NDJSON 事件流（每行一个事件）。 */
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

/** 前端 AI 气泡单轮状态机。输入框只在 'final' 解锁。 */
export type DailyTurnState =
  | 'created'
  | 'streaming_prose'
  | 'prose_complete'
  | 'streaming_sections'
  | 'sections_complete'
  | 'actions_ready'
  | 'final'

/** event → 状态转移规则（前端状态机契约）。未列出 = 状态不变。 */
export const DAILY_TURN_STATE_TRANSITIONS: Partial<Record<DailyStreamEvent['type'], DailyTurnState>> = {
  start: 'created',
  delta: 'streaming_prose',
  prose_complete: 'prose_complete',
  section_start: 'streaming_sections',
  sections_complete: 'sections_complete',
  actions: 'actions_ready',
  final: 'final',
  error: 'final',
}

/** 前端请求 POST /api/daily/stream 的 body 契约。 */
export interface DailyStreamRequest {
  /** 家长本轮输入，必填，trim 后非空 */
  text: string
  /** 同线程后续轮：复用首轮检索 packet（跳向量检索），可选 */
  warmTurn?: boolean
  /** 已展示过的 section id，用于去重/降级，可选 */
  recentSectionIds?: string[]
  /** 成熟度覆盖（调试用），可选 */
  maturityLevel?: string
}

/** 解析一行 NDJSON 为 DailyStreamEvent；非法行返回 null（前端 parser 共用）。 */
export function parseDailyStreamEvent(line: string): DailyStreamEvent | null {
  if (!line.trim()) return null
  try {
    return JSON.parse(line) as DailyStreamEvent
  } catch {
    return null
  }
}

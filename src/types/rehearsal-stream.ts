/**
 * Rehearsal 流式前后端共享契约类型。
 * 后端 emitter（app/api/rehearsal/analyze/route.ts）与前端 parser 共用，禁止各写各的松散 shape。
 */

/** 一轮预演 BFF → 前端的 NDJSON 事件流（每行一个事件）。 */
export type RehearsalStreamEvent =
  | { type: 'start'; traceId: string }
  | { type: 'reaction_delta'; delta: string }
  | { type: 'reaction_complete'; text: string }
  | { type: 'hearing_delta'; delta: string }
  | { type: 'hearing_complete'; text: string }
  | { type: 'suggested_delta'; delta: string }
  | { type: 'suggested_complete'; text: string }
  | {
      type: 'final'
      /** 完整结构化字段（结束页用：closingAdvice/taskTitle/saferVersion/riskPoints 等） */
      data: Record<string, unknown>
      traceId: string
    }
  | { type: 'error'; code: string; message: string }

/** 解析一行 NDJSON 为 RehearsalStreamEvent；非法行返回 null。 */
export function parseRehearsalStreamEvent(line: string): RehearsalStreamEvent | null {
  if (!line.trim()) return null
  try {
    return JSON.parse(line) as RehearsalStreamEvent
  } catch {
    return null
  }
}

/** Marker 流式分段标记（LLM 输出格式） */
export const REHEARSAL_MARKERS = {
  reaction: '---reaction---',
  hearing: '---hearing---',
  suggested: '---suggested---',
  rest: '---rest---',
} as const

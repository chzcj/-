// 契约测试：验证 daily stream 前后端事件/状态机/记忆 gate 对齐。
// 运行：node --import tsx scripts/test-daily-contract.mjs
import { parseDailyStreamEvent, DAILY_TURN_STATE_TRANSITIONS } from '../src/types/daily-stream.ts'

let pass = 0, fail = 0
const assert = (cond, msg) => { cond ? pass++ : (fail++, console.error('  ✗', msg)) }

// === 1. stream event contract：后端发的每种 event，前端 parser 都能识别 ===
console.log('1. stream event contract — parser 识别所有事件类型')
const events = [
  '{"type":"start","traceId":"t1"}',
  '{"type":"thinking","chips":[]}',
  '{"type":"delta","delta":"你"}',
  '{"type":"prose_complete"}',
  '{"type":"section_start","section":{"id":"s1","title":"x","kind":"observe"}}',
  '{"type":"section_delta","id":"s1","text":"hi"}',
  '{"type":"section_complete","section":{"id":"s1","title":"x","kind":"observe"}}',
  '{"type":"sections_complete","sections":[]}',
  '{"type":"sections","sections":[]}',
  '{"type":"actions","actions":[]}',
  '{"type":"final","text":"","sections":[],"actions":[],"traceId":"t1"}',
  '{"type":"error","code":"x","message":"y"}',
  '',
  'not-json',
]
for (const line of events) {
  const e = parseDailyStreamEvent(line)
  if (line.trim() && line !== 'not-json') assert(e !== null, `parser 应识别: ${line}`)
  else assert(e === null, `parser 应拒绝: ${line || '(空)'}`)
}

// === 2. state transition：delta→prose_complete→section_start→section_delta→section_complete→actions→final ===
console.log('2. state transition — 状态机转移')
const expected = {
  start: 'created',
  delta: 'streaming_prose',
  prose_complete: 'prose_complete',
  section_start: 'streaming_sections',
  sections_complete: 'sections_complete',
  actions: 'actions_ready',
  final: 'final',
  error: 'final',
}
for (const [evt, st] of Object.entries(expected)) {
  assert(DAILY_TURN_STATE_TRANSITIONS[evt] === st, `${evt} → ${st}`)
}

console.log(`\n契约测试：${pass} 通过，${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)

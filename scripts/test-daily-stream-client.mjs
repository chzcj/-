// 回归：prose delta 经 smooth 揭示后不得重复累加。
// 运行：node --import tsx scripts/test-daily-stream-client.mjs
import { readDailyStream } from '../src/lib/daily/dailyStreamClient.ts'

let pass = 0
let fail = 0
const assert = (cond, msg) => {
  if (cond) pass++
  else {
    fail++
    console.error('  ✗', msg)
  }
}

// Node 无 rAF：同步执行回调，便于断言 smooth 揭示结果
globalThis.requestAnimationFrame = (cb) => {
  cb()
  return 1
}
globalThis.cancelAnimationFrame = () => {}

function ndjsonResponse(lines) {
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n`))
      controller.close()
    },
  })
  return new Response(body, { status: 200 })
}

console.log('1. incremental deltas — display 为 acc 前缀，无翻倍')
{
  const deltas = []
  const res = ndjsonResponse([
    '{"type":"start","traceId":"t-smooth"}',
    '{"type":"delta","delta":"你"}',
    '{"type":"thinking","chips":[{"label":"当前理解","text":"x"}]}',
    '{"type":"delta","delta":"刚刚试"}',
    '{"type":"delta","delta":"的前10分钟"}',
    '{"type":"prose_complete"}',
    '{"type":"final","text":"你刚刚试的前10分钟","sections":[],"actions":[],"traceId":"t-smooth"}',
  ])

  const result = await readDailyStream(res, (text) => deltas.push(text))
  const expected = '你刚刚试的前10分钟'

  assert(result.acc === expected, `acc 应为 "${expected}"，实际 "${result.acc}"`)
  assert(deltas.length > 0, 'onDelta 应被调用')
  assert(deltas.every((d) => expected.startsWith(d)), '每次 display 必须是最终 acc 的前缀')
  assert(!deltas.some((d) => /你你|刚刚试刚刚试/.test(d)), 'display 不得含短语翻倍')
  assert(deltas[deltas.length - 1] === expected, `末次 display 应为完整正文`)
}

console.log('2. thinking / prose_complete 不得绕过 smooth 推全文')
{
  const deltas = []
  const res = ndjsonResponse([
    '{"type":"delta","delta":"看到"}',
    '{"type":"thinking","chips":[]}',
    '{"type":"prose_complete"}',
    '{"type":"final","text":"看到","sections":[],"actions":[],"traceId":"t2"}',
  ])

  await readDailyStream(res, (text) => deltas.push(text))
  assert(deltas.every((d) => '看到'.startsWith(d)), '非 delta 事件不应推送超 acc 的文本')
  assert(deltas[deltas.length - 1] === '看到', '流结束应揭示完整 acc')
}

console.log(`\nstream client 测试：${pass} 通过，${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)

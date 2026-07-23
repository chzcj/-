// 交流页 prose 首字延迟基准：登录 → POST /api/daily/stream → 统计 client/server 首字
// 用法: node --import tsx scripts/benchmark-prose-ttft.mjs
// 可选: RUNS=3 TEST_BASE_URL=https://yujian.yihe.site
import { parseDailyStreamEvent } from '../src/types/daily-stream.ts'

const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'
const PHONE = process.env.TEST_PHONE || '12234567890'
const PASSWORD = process.env.TEST_PASSWORD || 'Ab123456'
const RUNS = Math.max(1, Number(process.env.RUNS || 3))

let cookie = ''
async function login() {
  const h = { 'Content-Type': 'application/json', Origin: BASE, Referer: `${BASE}/daily` }
  let r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ phone: PHONE, password: PASSWORD }),
  })
  const sc = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : []
  for (const c of sc) {
    const part = c.split(';')[0]
    if (part.startsWith('childos_session=')) cookie = part
  }
  const j = await r.json()
  if (!j.ok) throw new Error(`login failed: ${JSON.stringify(j)}`)
}

async function runOnce({ label, text, warmTurn }) {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/api/daily/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      Origin: BASE,
      Referer: `${BASE}/daily`,
    },
    body: JSON.stringify({ text, warmTurn, recentSectionIds: [] }),
  })
  if (!res.ok) return { label, error: res.status }

  let clientFirstDelta = null
  let clientFirstChar = ''
  let timing = null
  let proseLen = 0

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const e = parseDailyStreamEvent(line)
      if (!e) continue
      if (e.type === 'delta') {
        if (clientFirstDelta === null) {
          clientFirstDelta = Date.now() - t0
          clientFirstChar = e.delta?.[0] || ''
        }
      }
      if (e.type === 'final') {
        timing = e.timing
        proseLen = e.text?.length ?? 0
      }
    }
  }

  const serverProseFirst =
    timing && typeof timing.orchestrationMs === 'number' && typeof timing.proseFirstMs === 'number'
      ? timing.orchestrationMs + timing.proseFirstMs
      : null

  return {
    label,
    warmTurn,
    clientFirstDeltaMs: clientFirstDelta,
    clientFirstChar,
    serverProseFirstMs: serverProseFirst,
    orchestrationMs: timing?.orchestrationMs ?? null,
    proseFirstMs: timing?.proseFirstMs ?? null,
    totalMs: timing?.totalMs ?? Date.now() - t0,
    proseLen,
  }
}

function stats(nums) {
  const sorted = [...nums].sort((a, b) => a - b)
  const avg = Math.round(sorted.reduce((s, x) => s + x, 0) / sorted.length)
  const p50 = sorted[Math.floor(sorted.length / 2)]
  return { min: sorted[0], p50, max: sorted[sorted.length - 1], avg }
}

console.log(`=== prose 首字延迟基准 (${BASE}, ${RUNS} 轮) ===\n`)
await login()
console.log(`登录 ok (${PHONE})\n`)

const inputs = [
  { text: '孩子初二，最近写作业总是拖到很晚，我催他就发脾气，不催就不写，怎么办？', warmTurn: false },
  { text: '昨晚又因为手机吵了一架，他说我不信任他，我不知道该怎么接话。', warmTurn: false },
  { text: '嗯，我试了你说的先共情，他还是关门不理我。', warmTurn: true },
]

const results = []
for (let i = 0; i < RUNS; i++) {
  const input = inputs[i % inputs.length]
  const label = `run-${i + 1}${input.warmTurn ? '-warm' : '-cold'}`
  const r = await runOnce({ label, ...input })
  results.push(r)
  console.log(
    `${label}: client首字=${r.clientFirstDeltaMs}ms char="${r.clientFirstChar}" | server orchestration=${r.orchestrationMs}ms proseFirst=${r.proseFirstMs}ms → 首字合计=${r.serverProseFirstMs}ms | total=${r.totalMs}ms prose=${r.proseLen}字`,
  )
}

const clientMs = results.map((r) => r.clientFirstDeltaMs).filter((n) => typeof n === 'number')
const serverMs = results.map((r) => r.serverProseFirstMs).filter((n) => typeof n === 'number')
const coldClient = results.filter((r) => !r.warmTurn).map((r) => r.clientFirstDeltaMs)
const warmClient = results.filter((r) => r.warmTurn).map((r) => r.clientFirstDeltaMs)

console.log('\n--- 汇总 ---')
console.log(`客户端首字（请求→首个 delta）: ${JSON.stringify(stats(clientMs))} ms`)
console.log(`服务端首字（orchestration+proseFirst）: ${JSON.stringify(stats(serverMs))} ms`)
if (coldClient.length) console.log(`冷启动 client: ${JSON.stringify(stats(coldClient))} ms`)
if (warmClient.length) console.log(`暖轮 client: ${JSON.stringify(stats(warmClient))} ms`)

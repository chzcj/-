// 端到端 stream smoke：登录测试账号 → POST /api/daily/stream → 校验事件序列 + final payload + memory-status
// 用法: TEST_PHONE=12234567890 TEST_PASSWORD=Ab123456 node --import tsx scripts/test-daily-stream-e2e.mjs
import { parseDailyStreamEvent, DAILY_TURN_STATE_TRANSITIONS } from '../src/types/daily-stream.ts'

const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'
const PHONE = process.env.TEST_PHONE || '12234567890'
const PASSWORD = process.env.TEST_PASSWORD || 'Ab123456'

let pass = 0, fail = 0
const assert = (c, m) => { c ? pass++ : (fail++, console.error('  ✗', m)) }

let cookie = ''
async function req(p, body, opt = {}) {
  const h = { 'Content-Type': 'application/json', Origin: BASE, Referer: `${BASE}/daily` }
  if (cookie) h.Cookie = cookie
  const r = await fetch(`${BASE}${p}`, { method: opt.method || 'POST', headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' })
  const sc = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : []
  for (const c of sc) { const part = c.split(';')[0]; if (part.startsWith('childos_session=')) cookie = part }
  const text = await r.text().catch(() => '')
  let json = {}; try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text.slice(0, 200) } }
  return { status: r.status, json, text }
}

console.log('=== 端到端 stream smoke ===')

// 1. 登录（登录失败则注册）
let r = await req('/api/auth/login', { phone: PHONE, password: PASSWORD })
if (!r.json?.ok && r.json?.error?.code === 'BAD_CREDENTIALS') {
  r = await req('/api/auth/register', { phone: PHONE, password: PASSWORD })
}
assert(r.status === 200 && r.json?.ok, `login/register 成功 (phone=${PHONE})`)
console.log(`  登录: ${r.json?.ok ? 'ok' : r.json?.error?.code || r.status}`)

if (!r.json?.ok) { console.log(`\n结果: ${pass} 通过 ${fail} 失败（登录失败，终止）`); process.exit(1) }

// 2. 真实交流 stream
const userInput = '孩子初二，最近写作业总是拖到很晚，我催他就发脾气，不催就不写，怎么办？'
console.log(`\n2. POST /api/daily/stream — 输入: "${userInput.slice(0, 30)}..."`)
const streamRes = await fetch(`${BASE}/api/daily/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: BASE, Referer: `${BASE}/daily` },
  body: JSON.stringify({ text: userInput, warmTurn: false, recentSectionIds: [] }),
})
assert(streamRes.status === 200, `stream 200 (got ${streamRes.status})`)
assert(streamRes.headers.get('content-type')?.includes('ndjson') || streamRes.headers.get('content-type')?.includes('stream') || streamRes.headers.get('content-type')?.includes('octet') || streamRes.headers.get('content-type')?.includes('text'), `stream content-type=${streamRes.headers.get('content-type')}`)

// 流式 reader：记录关键事件时间戳
const t0 = Date.now()
const eventTimes = {}
const events = []
const reader = streamRes.body.getReader()
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
    events.push(e)
    // 记录每种事件首次出现时间
    const key = e.type === 'section_start' ? 'section_start' :
                e.type === 'section_delta' ? 'section_delta' :
                e.type === 'delta' ? 'delta' : e.type
    if (!(key in eventTimes)) eventTimes[key] = Date.now() - t0
  }
}
console.log(`  收到 ${events.length} 个事件`)
const typeCounts = {}
for (const e of events) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1
console.log(`  事件类型分布: ${JSON.stringify(typeCounts)}`)
console.log(`  事件首达时间: start=${eventTimes.start}ms delta=${eventTimes.delta}ms prose_complete=${eventTimes.prose_complete}ms section_start=${eventTimes.section_start}ms section_delta=${eventTimes.section_delta}ms`)
if (eventTimes.prose_complete && eventTimes.section_start) {
  const gap = eventTimes.section_start - eventTimes.prose_complete
  console.log(`  section_start 相对 prose_complete 延迟: ${gap}ms ${gap < 500 ? '✓ 无缝' : gap < 2000 ? '⚠ 有间隙' : '✗ 明显等待'}`)
}

// 3. 校验事件序列契约
const types = events.map(e => e.type)
assert(types[0] === 'start', `首个事件 = start (got ${types[0]})`)
assert(types.includes('delta'), '包含 delta（正文流式）')
assert(types.includes('prose_complete') || types.includes('final'), '包含 prose_complete 或 final')
assert(types[types.length - 1] === 'final' || types[types.length - 1] === 'error', `末事件 = final/error (got ${types[types.length-1]})`)

// 4. 校验状态机：每个事件都能映射
for (const t of types) {
  if (!(t in DAILY_TURN_STATE_TRANSITIONS) && t !== 'section_delta' && t !== 'section_complete' && t !== 'section_start' && t !== 'section_error' && t !== 'sections' && t !== 'thinking') {
    assert(false, `未知事件类型: ${t}`)
  }
}

// 5. 校验 final payload
const finalEvt = events.find(e => e.type === 'final')
if (finalEvt) {
  assert(typeof finalEvt.text === 'string' && finalEvt.text.length > 0, `final.text 非空 (len=${finalEvt.text?.length})`)
  assert(Array.isArray(finalEvt.sections), `final.sections 是数组`)
  assert(Array.isArray(finalEvt.actions), `final.actions 是数组`)
  assert(typeof finalEvt.traceId === 'string', `final.traceId 存在 (${finalEvt.traceId?.slice(0,20)})`)
  console.log(`  final: text=${finalEvt.text.length}字 sections=${finalEvt.sections?.length} actions=${finalEvt.actions?.length} traceId=${finalEvt.traceId?.slice(0,24)}`)

  const rt = finalEvt.runtime
  if (rt && typeof rt === 'object') {
    const r = rt
    console.log(`  runtime: mergedSp=${r.mergedSpCall} proseLen=${r.proseLen} visibleSections=${r.visibleSectionCount} taskTitle=${r.taskTitlePresent} sectionIds=${JSON.stringify(r.sectionIdsCompleted)}`)
    assert(r.mergedSpCall === true, 'runtime.mergedSpCall=true（合并 SP 调用）')
    assert(typeof r.proseLen === 'number' && r.proseLen > 0, `runtime.proseLen>0 (got ${r.proseLen})`)
    assert(Array.isArray(r.sectionIdsCompleted) && r.sectionIdsCompleted.length > 0, 'runtime.sectionIdsCompleted 非空')
    if (r.promptCache && typeof r.promptCache === 'object') {
      console.log(`  promptCache: ${JSON.stringify(r.promptCache).slice(0, 120)}`)
    }
  }

  // timing 验证：proseFirstMs（首字）+ sectionsMs（section 完成）
  const t = finalEvt.timing
  if (t) {
    console.log(`  timing: orchestration=${t.orchestrationMs}ms proseFirst=${t.proseFirstMs}ms parallel=${t.parallelMs}ms sections=${t.sectionsMs}ms total=${t.totalMs}ms`)
    assert(typeof t.orchestrationMs === 'number', 'timing.orchestrationMs 存在')
    assert(typeof t.proseFirstMs === 'number', 'timing.proseFirstMs 存在（首字时间）')
    // section 完成时间应 < orchestration + prose 全程 + section LLM 全程（并行后应明显快于串行）
    assert(t.sectionsMs > 0, 'timing.sectionsMs > 0')
  }

  // 6. memory-status 查得到该 traceId
  console.log(`\n3. GET /api/daily/memory-status?traceId=${finalEvt.traceId?.slice(0,24)}`)
  const ms = await req(`/api/daily/memory-status?traceId=${finalEvt.traceId}`, undefined, { method: 'GET' })
  assert(ms.status === 200, `memory-status 200 (got ${ms.status})`)
  console.log(`  memory-status: ${JSON.stringify(ms.json?.data || ms.json?.error || ms.json).slice(0, 160)}`)
}

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`)
process.exit(fail === 0 ? 0 : 1)

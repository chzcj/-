// rehearsal 流式计时 smoke：登录 → POST /api/rehearsal/analyze (NDJSON) → reaction 首字 + final 计时
const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'
const PHONE = process.env.TEST_PHONE || '12234567890'
const PASSWORD = process.env.TEST_PASSWORD || 'Ab123456'

let cookie = ''
async function req(p, body, opt = {}) {
  const h = { 'Content-Type': 'application/json', Origin: BASE, Referer: `${BASE}/rehearsal` }
  if (cookie) h.Cookie = cookie
  const r = await fetch(`${BASE}${p}`, { method: opt.method || 'POST', headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' })
  const sc = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : []
  for (const c of sc) { const part = c.split(';')[0]; if (part.startsWith('childos_session=')) cookie = part }
  return r
}

console.log('=== rehearsal 流式计时 smoke ===')
const r0 = await req('/api/auth/login', { phone: PHONE, password: PASSWORD })
const lj = await r0.json().catch(() => ({}))
if (!lj?.ok && lj?.error?.code === 'BAD_CREDENTIALS') {
  await req('/api/auth/register', { phone: PHONE, password: PASSWORD })
}
console.log('登录 ok')

const parentText = '你别再玩了，赶紧去写作业，写完才能玩手机，听到没有？'
console.log(`\nPOST /api/rehearsal/analyze (流式) — "${parentText.slice(0,20)}..."`)
const t0 = Date.now()
const res = await req('/api/rehearsal/analyze', {
  parentText,
  fromSpecialFeature: true,
  parentRoundCount: 1,
})

const ct = res.headers.get('content-type') || ''
console.log(`content-type: ${ct}`)
let firstReactionAt = null
let finalAt = null
let reactionText = ''
let finalData = null

if (ct.includes('ndjson') && res.body) {
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
      if (!line.trim()) continue
      try {
        const evt = JSON.parse(line)
        if (evt.type === 'reaction_delta') {
          if (firstReactionAt === null) {
            firstReactionAt = Date.now() - t0
            console.log(`  reaction 首字: ${firstReactionAt}ms`)
          }
          reactionText += evt.delta
        } else if (evt.type === 'final') {
          finalAt = Date.now() - t0
          finalData = evt.data
        } else if (evt.type === 'error') {
          console.log(`  error: ${evt.code} ${evt.message}`)
        }
      } catch {}
    }
  }
  console.log(`\nreaction 全文: ${reactionText.slice(0,80)}`)
  console.log(`final.data.uiMode: ${finalData?.uiMode}`)
  console.log(`final.data.childLikelyHearing: ${(finalData?.childLikelyHearing||'').slice(0,60)}`)
  console.log(`\n计时: reaction首字=${firstReactionAt}ms  final=${finalAt}ms`)
  console.log(`结果: 首字 ${firstReactionAt < 4000 ? '✓ 快' : firstReactionAt < 6000 ? '⚠ 可接受' : '✗ 慢'} | 总 ${finalAt < 10000 ? '✓' : '⚠ 偏慢'} (${finalAt}ms)`)
} else {
  // 旧 JSON 路径
  const j = await res.json().catch(() => ({}))
  const ms = Date.now() - t0
  console.log(`旧 JSON 路径: ${ms}ms ok=${j.ok}`)
  console.log(`结果: ${ms < 8000 ? '✓' : '⚠ 偏慢'} (${ms}ms)`)
}

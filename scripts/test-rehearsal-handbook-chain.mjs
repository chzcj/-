// 预演结束 → 任务/手账准入链 smoke
// 运行：TEST_BASE_URL=... npx tsx scripts/test-rehearsal-handbook-chain.mjs

import {
  getRehearsalEndCopy,
  pickRehearsalTaskTitle,
  rehearsalEndHandbookEligible,
} from '../packages/contracts/src/rehearsal-end.ts'

const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'
const PHONE = process.env.TEST_PHONE || '12234567890'
const PASSWORD = process.env.TEST_PASSWORD || 'Ab123456'

let cookie = ''
async function req(path, body, opt = {}) {
  const h = { 'Content-Type': 'application/json', Origin: BASE, Referer: `${BASE}/rehearsal` }
  if (cookie) h.Cookie = cookie
  const r = await fetch(`${BASE}${path}`, {
    method: opt.method || 'POST',
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  const sc = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : []
  for (const c of sc) {
    const part = c.split(';')[0]
    if (part.startsWith('childos_session=')) cookie = part
  }
  return r
}

let pass = 0
let fail = 0
const assert = (c, m) => {
  if (c) pass++
  else (fail++, console.error('  ✗', m))
}

console.log('=== 预演结束 → 手账/任务链 smoke ===\n')

console.log('1. 共享 copy 模块')
const mockEnd = {
  closingAdvice: '先离开十分钟，再问要不要一起看第一题。',
  childLikelyHearing: '听到催就会顶回去。',
  saferVersion: '今晚先让孩子自己选第一项，你暂时离开十分钟。',
  taskTitle: '今晚试：离开十分钟后再问要不要一起看第一题',
}
const copy = getRehearsalEndCopy(mockEnd)
assert(copy.summary.includes('十分钟'), 'summary 来自 closingAdvice')
assert(copy.trigger.includes('顶回'), 'trigger 来自 childLikelyHearing')
const title = pickRehearsalTaskTitle(mockEnd)
assert(title.length >= 8, 'taskTitle 准入 ≥8 字')
assert(rehearsalEndHandbookEligible(mockEnd), 'handbook eligible')

console.log('\n2. POST /api/rehearsal/analyze final 字段')
await req('/api/auth/login', { phone: PHONE, password: PASSWORD })
const parentText = '你先选做哪一科，我去洗碗，十分钟后我只问要不要一起看最后一题。'
const t0 = Date.now()
const res = await req('/api/rehearsal/analyze', {
  parentText,
  fromSpecialFeature: true,
  parentRoundCount: 2,
  sceneSummary: '作业启动前容易顶回',
})
const ct = res.headers.get('content-type') || ''
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
        if (evt.type === 'final') finalData = evt.data
      } catch {
        /* ignore */
      }
    }
  }
} else {
  const j = await res.json().catch(() => ({}))
  finalData = j.data
}
const ms = Date.now() - t0
console.log(`  analyze ${ms}ms`)

if (finalData) {
  const liveCopy = getRehearsalEndCopy(finalData)
  assert(Boolean(liveCopy.summary?.trim()), 'live closingAdvice/summary 非空')
  assert(Boolean(liveCopy.tryTonight?.trim()), 'live tryTonight 非空')
  const liveTitle = pickRehearsalTaskTitle(finalData, parentText)
  console.log(`  taskTitle 候选: ${liveTitle.slice(0, 48)}…`)
  assert(liveTitle.length >= 4, '至少有任务标题候选')
} else {
  assert(false, '未收到 final 事件')
}

console.log(`\n=== 结果: ${pass} pass, ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)

#!/usr/bin/env node
/**
 * 模拟家长采集全流程：短输入 → AI 追问 → 补充 → 阶段整理
 * 用法: node scripts/test-build-flow.mjs
 * 环境: TEST_BASE_URL (默认 https://yujian.yihe.site)
 */

const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'
const ORIGIN = new URL(BASE).origin
const API_KEY = process.env.INTERNAL_API_TOKEN || process.env.FAST_AI_API_KEY || ''

const SHORT_INPUT = '您好'
const RICH_INPUT = `放学回家先吃饭，然后说休息一会儿。拿起手机就很难放下，我催他写作业他说知道了，半小时后还是没动。后来我坐在旁边他才动笔，写到九点多。周末还有一节补课，他一听就烦。`

const FOLLOWUP_ANSWER = `一般是写完一点或被提醒以后就想看手机。不是完全不学，但我再提醒他就很烦。睡前也停不下来，后来我不敢给他手机，但不给又觉得我管太多。`

let cookieJar = ''

async function request(path, body, { method = 'POST' } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`,
  }
  if (API_KEY) headers['x-api-key'] = API_KEY
  else if (cookieJar) headers.Cookie = cookieJar
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const rawSetCookie = res.headers.get('set-cookie')
  const cookieParts = setCookie.length ? setCookie : rawSetCookie ? [rawSetCookie] : []
  for (const c of cookieParts) {
    const part = c.split(';')[0]
    if (part.startsWith('childos_session=')) {
      cookieJar = part
    }
  }
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

function ok(label, cond, detail = '') {
  const mark = cond ? '✓' : '✗'
  console.log(`  ${mark} ${label}${detail ? `: ${detail}` : ''}`)
  return cond
}

async function demoLogin() {
  console.log('\n[1] Demo 登录')
  const { status, json } = await request('/api/auth/demo', {})
  const passed = ok('登录成功', json.ok === true, json.data?.user?.phone || `status=${status}`)
  return passed
}

async function testEntryGate(entryType, rawText, label) {
  console.log(`\n[entry] ${label} (${entryType})`)
  console.log(`  输入: ${rawText.slice(0, 40)}${rawText.length > 40 ? '…' : ''} (${rawText.length}字)`)
  const { status, json } = await request('/api/entry/analyze', {
    entryType,
    rawText,
    stage: 'entry',
  })
  if (!ok('API 返回 ok', json.ok === true, `status=${status} code=${json.error?.code || '-'}`)) {
    console.log('  错误:', JSON.stringify(json.error || json).slice(0, 200))
    return null
  }
  const d = json.data || {}
  ok('有 purpose', Boolean(d.purpose), (d.purpose || '').slice(0, 60))
  ok('有 voicePrompt', Boolean(d.voicePrompt), (d.voicePrompt || '').slice(0, 60))
  ok('有 directions', Array.isArray(d.directions) && d.directions.length > 0, `${(d.directions || []).length} 个`)
  console.log(`  shouldAsk=${d.shouldAsk !== false} (${d.shouldAsk === false ? '信息够，可跳过追问' : '需要追问'})`)
  return d
}

async function testSummary(entryType, combinedText, label) {
  console.log(`\n[summary] ${label} (${entryType})`)
  console.log(`  合并文本: ${combinedText.length}字`)
  const { status, json } = await request('/api/entry/analyze', {
    entryType,
    rawText: combinedText,
    stage: 'summary',
  })
  if (!ok('API 返回 ok', json.ok === true, `status=${status} code=${json.error?.code || '-'}`)) {
    console.log('  错误:', JSON.stringify(json.error || json).slice(0, 200))
    return null
  }
  const d = json.data || {}
  ok('有 mainJudgment', Boolean(d.mainJudgment), (d.mainJudgment || '').slice(0, 80))
  ok('有 facts', Array.isArray(d.facts) && d.facts.length >= 1, `${(d.facts || []).length} 条`)
  ok('有 pendingHypotheses', Array.isArray(d.pendingHypotheses) && d.pendingHypotheses.length >= 1, `${(d.pendingHypotheses || []).length} 条`)
  return d
}

async function simulateModuleFlow(entryType, title) {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`模块: ${title} (${entryType})`)
  console.log('='.repeat(50))

  const gate1 = await testEntryGate(entryType, SHORT_INPUT, '短输入「您好」')
  if (!gate1) return { entryType, ok: false, step: 'short-entry' }

  const gate2 = await testEntryGate(entryType, RICH_INPUT, '较完整首轮输入')
  if (!gate2) return { entryType, ok: false, step: 'rich-entry' }

  let combined = RICH_INPUT
  if (gate2.shouldAsk !== false) {
    combined = `${RICH_INPUT}\n\n${FOLLOWUP_ANSWER}`
    const gate3 = await testEntryGate(entryType, combined, '首轮+补充后再次判断')
    if (!gate3) return { entryType, ok: false, step: 'followup-entry' }
  }

  const summary = await testSummary(entryType, combined, '阶段整理')
  if (!summary) return { entryType, ok: false, step: 'summary' }

  return { entryType, ok: true, shouldAskShort: gate1.shouldAsk !== false, shouldAskRich: gate2.shouldAsk !== false }
}

async function main() {
  console.log('========================================')
  console.log('育见 · 采集全流程 API 模拟测试')
  console.log(`目标: ${BASE}`)
  console.log('========================================')

  const readiness = await request('/api/readiness', undefined, { method: 'GET' })
  if (!ok('服务就绪', readiness.json.ok === true)) {
    process.exit(2)
  }

  if (!(await demoLogin())) {
    process.exit(2)
  }

  const modules = [
    ['daily', '孩子平时怎么过'],
    ['homework', '学习和作业'],
    ['communication', '亲子沟通'],
    ['family', '家庭支持'],
  ]

  const results = []
  for (const [type, title] of modules) {
    results.push(await simulateModuleFlow(type, title))
  }

  console.log('\n========================================')
  console.log('汇总')
  console.log('========================================')
  let allOk = true
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗'
    const extra = r.ok ? `短输入shouldAsk=${r.shouldAskShort} 完整输入shouldAsk=${r.shouldAskRich}` : `失败于 ${r.step}`
    console.log(`  ${mark} ${r.entryType}: ${extra}`)
    if (!r.ok) allOk = false
  }

  console.log(allOk ? '\n=== 全流程通过 ===' : '\n=== 存在失败项 ===')
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(2)
})

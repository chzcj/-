#!/usr/bin/env node
/**
 * 模拟四模块建档收尾：4×summary → final → POST build-run → 轮询监督字段。
 * 用法: node scripts/simulate-onboarding-final-chain.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'
const ORIGIN = new URL(BASE).origin
const CORPUS = path.join(ROOT, 'scripts/xiaoyin-mom-corpus/01_profile_build_inputs.json')
const POLL_MS = 3000
const MAX_POLL = 90 // ~4.5min

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

loadEnv()

let cookieJar = ''

async function request(path, body, { method = 'POST', timeoutMs = 120_000 } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`,
  }
  const token = process.env.INTERNAL_API_TOKEN
  if (token) headers['x-api-key'] = token
  else if (cookieJar) headers.Cookie = cookieJar

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    const rawSetCookie = res.headers.get('set-cookie')
    const cookieParts = setCookie.length ? setCookie : rawSetCookie ? [rawSetCookie] : []
    for (const c of cookieParts) {
      const part = c.split(';')[0]
      if (part.startsWith('childos_session=')) cookieJar = part
    }
    const json = await res.json().catch(() => ({}))
    return { status: res.status, json }
  } finally {
    clearTimeout(t)
  }
}

function ok(label, cond, detail = '') {
  const mark = cond ? '✓' : '✗'
  console.log(`  ${mark} ${label}${detail ? `: ${detail}` : ''}`)
  return cond
}

function moduleCombinedText(mod) {
  const rounds = mod.rounds || []
  const texts = rounds.slice(0, 2).map((r) => r.parentText).filter(Boolean)
  return texts.join('\n\n')
}

async function main() {
  console.log('========================================')
  console.log('四模块收尾链路模拟（summary → final → build-run）')
  console.log(`目标: ${BASE}`)
  console.log('========================================\n')

  const readiness = await request('/api/readiness', undefined, { method: 'GET', timeoutMs: 15_000 })
  if (!ok('readiness ok', readiness.json?.ok === true)) process.exit(2)
  const jobs = readiness.json?.data?.checks?.jobs
  ok('workerAlive', jobs?.workerAlive === true, `ageMs=${jobs?.heartbeatAgeMs}`)
  ok('jobHealthy', jobs?.jobHealthy === true, `pending=${jobs?.pending}`)

  const token = process.env.INTERNAL_API_TOKEN
  if (token) {
    console.log('\n[auth] 使用 INTERNAL_API_TOKEN（租户回落 f_demo）')
  } else {
    const login = await request('/api/auth/demo', {})
    if (!ok('demo 登录', login.json?.ok === true, login.json?.data?.user?.phone || login.json?.error?.message)) {
      process.exit(2)
    }
  }

  const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'))
  const entryMap = {}
  const stageSummaries = []
  const completedEntries = []

  for (const mod of corpus.modules) {
    const { entryType, title } = mod
    const combined = moduleCombinedText(mod)
    console.log(`\n[${entryType}] ${title} (${combined.length}字)`)

    const t0 = Date.now()
    const summary = await request('/api/entry/analyze', {
      entryType,
      rawText: combined,
      stage: 'summary',
    })
    const ms = Date.now() - t0
    if (!ok('summary 200', summary.json?.ok === true, `${ms}ms`)) {
      console.log('  err:', JSON.stringify(summary.json?.error || summary.json).slice(0, 300))
      process.exit(1)
    }
    const d = summary.json.data || {}
    ok('mainJudgment', Boolean(d.mainJudgment?.trim()), preview(d.mainJudgment, 70))
    ok('facts', Array.isArray(d.facts) && d.facts.length >= 1, `${(d.facts || []).length}条`)

    entryMap[entryType] = {
      rawTexts: [combined.split('\n\n')[0] || combined],
      followUps: combined.includes('\n\n') ? [combined.split('\n\n').slice(1).join('\n\n')] : [],
      stageSummary: d.mainJudgment || '',
      aiFacts: d.facts || [],
      aiHypotheses: d.pendingHypotheses || [],
      moduleComplete: true,
      summarySufficient: d.sufficient !== false,
    }
    stageSummaries.push({
      entryType,
      mainJudgment: d.mainJudgment,
      facts: d.facts,
      pendingHypotheses: d.pendingHypotheses,
      sufficient: d.sufficient,
    })
    completedEntries.push(entryType)
  }

  console.log('\n[build-state] 同步进度')
  const bs = await request('/api/profile/build-state', {
    introSeen: true,
    basicInfoDone: false,
    completedEntries,
    stageSummaries,
  })
  ok('build-state saved', bs.json?.ok === true)

  const finalText = corpus.finalFollowUp?.parentText || '其实他并不是不努力，而是每次我一催，他就觉得后面又要被检查很久。'
  console.log(`\n[final] 最后补充 (${finalText.length}字)`)
  const final = await request('/api/entry/analyze', {
    entryType: 'final',
    rawText: finalText,
    stage: 'entry',
  }, { timeoutMs: 45_000 })
  ok('final analyze', final.json?.ok === true)

  console.log('\n[build-run] POST 启动画像整理')
  const tStart = Date.now()
  const start = await request('/api/profile/build-run', {
    entryMap,
    finalFollowUpText: finalText,
  })
  if (!ok('build-run POST', start.json?.ok === true, start.json?.error?.message)) {
    process.exit(1)
  }
  const run0 = start.json.data?.run
  ok('runId', Boolean(run0?.runId), run0?.runId)
  ok('status pending/running', ['pending', 'running'].includes(run0?.status), run0?.status)

  let lastPhase = -1
  let succeeded = false
  let failed = false
  let lastAudit = null

  for (let i = 0; i < MAX_POLL; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS))
    const poll = await request('/api/profile/build-run', undefined, { method: 'GET', timeoutMs: 30_000 })
    if (!poll.json?.ok) continue
    const run = poll.json.data?.run
    const audit = poll.json.data?.pipelineAudit
    lastAudit = audit
    if (run?.phase !== lastPhase) {
      lastPhase = run?.phase
      console.log(`  … phase=${run?.phase} label=${run?.label} status=${run?.status} (${Math.round((Date.now() - tStart) / 1000)}s)`)
    }
    if (audit && !audit.healthy && audit.gaps?.length) {
      console.log(`  [pipeline] healthy=false gaps=${audit.gaps.slice(0, 2).join(' | ')}`)
    }
    if (run?.status === 'succeeded') {
      succeeded = true
      break
    }
    if (run?.status === 'failed') {
      failed = true
      console.log(`  FAILED: ${run.error} stage=${run.failedStage}`)
      break
    }
  }

  const wallSec = Math.round((Date.now() - tStart) / 1000)
  console.log(`\n[结果] wall=${wallSec}s succeeded=${succeeded} failed=${failed}`)

  const built = await request('/api/profile/built', undefined, { method: 'GET' })
  ok('built snapshot', built.json?.data?.snapshot?.coreJudgment?.trim()?.length > 20,
    preview(built.json?.data?.snapshot?.coreJudgment, 80))

  if (lastAudit) {
    console.log('\n[pipelineAudit]')
    ok('workerAlive', lastAudit.workerAlive === true)
    ok('pipelineHealthy', lastAudit.healthy === true, lastAudit.gaps?.join('; ') || '')
    for (const m of lastAudit.modules || []) {
      ok(`${m.entryType} packReady`, m.packReady === true, m.evidenceJobStatus || 'no-job')
    }
    ok('builtSnapshotReady', lastAudit.builtSnapshotReady === true)
  }

  console.log(succeeded ? '\n=== 收尾链路通过 ===' : '\n=== 收尾链路失败或超时 ===')
  process.exit(succeeded ? 0 : 1)
}

function preview(text, max = 120) {
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(2)
})

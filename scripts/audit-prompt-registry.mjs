#!/usr/bin/env node
/**
 * 校验 registry 中所有 prompt key 可被代码引用，并对关键 Agent 做最小 ping。
 *
 *   node scripts/audit-prompt-registry.mjs
 *   TEST_BASE_URL=https://yujian.yihe.site node scripts/audit-prompt-registry.mjs --ping
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY = path.join(ROOT, 'src/lib/server/prompts/registry.generated.ts')
const PING = process.argv.includes('--ping')
const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'

const registrySrc = fs.readFileSync(REGISTRY, 'utf8')
const keys = [...registrySrc.matchAll(/^\s+"([^"]+)":/gm)].map((m) => m[1])

/** 代码中显式引用的 agent key（grep 维护） */
const REQUIRED_IN_CODE = [
  'entryDailyFollowUp',
  'entryDailySummary',
  'entryHomeworkFollowUp',
  'entryHomeworkSummary',
  'entryCommunicationFollowUp',
  'entryCommunicationSummary',
  'entryFamilyFollowUp',
  'entryFamilySummary',
  'entryFinalFollowUp',
  'profileBuildSynthesis',
  'profileBuildDiagnosis',
  'entryBuildStyle',
  'parentFacingStyle',
  'parentFacingCopy',
  'dailyDialogueOrchestration',
  'multiEntrySynthesis',
  'deepDiagnosis',
  'entryFollowUp',
  'entryStageSummary',
  'communicationRehearsal',
]

const missing = REQUIRED_IN_CODE.filter((k) => !keys.includes(k))
const orphan = keys.filter((k) => !REQUIRED_IN_CODE.includes(k) && k.startsWith('entry'))

console.log('=== Prompt Registry 审计 ===')
console.log(`registry keys: ${keys.length}`)
if (missing.length) {
  console.error('✗ 缺失 key:', missing.join(', '))
  process.exit(1)
}
console.log('✓ 必需 key 均在 registry')

/** 估算各 system prompt 字符数（token 粗算 ≈ chars/2） */
const charLens = {}
for (const k of keys) {
  const re = new RegExp(`"${k}":\\s*"([\\s\\S]*?)",\\n`, 'm')
  const m = registrySrc.match(re)
  if (m) charLens[k] = m[1].length
}
const heavy = Object.entries(charLens)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
console.log('\n=== System Prompt 体积 Top 8（字符 ≈ token×2）===')
for (const [k, n] of heavy) {
  console.log(`  ${k}: ${n} chars (~${Math.round(n / 2)} tok)`)
}

/** 单次流程 LLM 调用次数估算 */
console.log('\n=== 单次用户路径 LLM 调用估算 ===')
console.log('四模块首次建模（每模块首轮+总结，无多轮追问）:')
console.log('  entry analyze follow-up ×4 + summary ×4 = 8')
console.log('  final follow-up ×1')
console.log('  synthesis ×1 + diagnosis ×1 = 2')
console.log('  合计前台路径 ≈ 11 次（已跳过 entry_evidence 当 facts≥2）')
console.log('日常交流每轮: prose流式×1 + sectionCopy×1 + 可选 hidden×2 ≈ 2–4')
console.log('优化: entry 采集不再附带 parentFacingStyle（每 call 省 ~6k tok）')

if (!PING) {
  console.log('\n加 --ping 可对生产 /api/entry/analyze 做 smoke（需 TEST_PHONE/TEST_PASSWORD）')
  process.exit(0)
}

const phone = process.env.TEST_PHONE
const password = process.env.TEST_PASSWORD
if (!phone || !password) {
  console.error('ping 需要 TEST_PHONE 和 TEST_PASSWORD')
  process.exit(2)
}

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  })
  const setCookie = r.headers.getSetCookie?.() || []
  return setCookie.map((c) => c.split(';')[0]).join('; ')
}

async function pingEntry(entryType, rawText, stage = 'entry') {
  const cookie = await login()
  const t0 = Date.now()
  const r = await fetch(`${BASE}/api/entry/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ entryType, rawText, stage }),
  })
  const json = await r.json()
  const ms = Date.now() - t0
  const ok = json.ok
  const preview = ok
    ? JSON.stringify(json.data).slice(0, 80)
    : json.error?.message?.slice(0, 60)
  console.log(`${ok ? '✓' : '✗'} ${entryType}/${stage} ${ms}ms ${preview}`)
  return ok
}

const smokeText = '孩子说知道了但不行动，我提醒后他沉默。'
let pass = 0
for (const et of ['daily', 'final']) {
  if (await pingEntry(et, smokeText)) pass++
}
console.log(`\nping: ${pass}/2`)
process.exit(pass === 2 ? 0 : 1)

#!/usr/bin/env node
/**
 * 账号生命周期 + 服务端持久化验收
 *
 * 用法:
 *   node scripts/test-account-lifecycle.mjs
 *   TEST_BASE_URL=https://yujian.yihe.site node scripts/test-account-lifecycle.mjs
 *   TEST_PHONE=13017552641 TEST_PASSWORD=xxx node scripts/test-account-lifecycle.mjs
 *
 * 环境变量:
 *   TEST_BASE_URL   默认 https://yujian.yihe.site
 *   TEST_PHONE      可选，真实账号登录测试
 *   TEST_PASSWORD   与 TEST_PHONE 配对
 *   AUDIT_PHONE     仅 DB 审计手机号，默认 13017552641（需本机 SSH 到服务器）
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'
const ORIGIN = new URL(BASE).origin
const AUDIT_PHONE = process.env.AUDIT_PHONE || '13017552641'
const REPORT_PATH =
  process.env.LIFECYCLE_OUT ||
  path.join(ROOT, 'scripts/test-reports', `account-lifecycle-${Date.now()}.json`)

const report = {
  meta: { base: BASE, startedAt: new Date().toISOString(), finishedAt: null },
  summary: { total: 0, ok: 0, fail: 0 },
  steps: [],
}

let cookieJar = ''

function record(name, ok, detail = {}) {
  report.steps.push({ name, ok, ...detail })
  report.summary.total += 1
  if (ok) report.summary.ok += 1
  else report.summary.fail += 1
  const mark = ok ? '✅' : '❌'
  console.log(`${mark} ${name}${detail.message ? ` — ${detail.message}` : ''}`)
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

async function request(pathname, body, { method = 'POST' } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    Referer: `${ORIGIN}/login`,
  }
  if (cookieJar) headers.Cookie = cookieJar
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const rawSetCookie = res.headers.get('set-cookie')
  const cookieParts = setCookie.length ? setCookie : rawSetCookie ? [rawSetCookie] : []
  for (const c of cookieParts) {
    const part = c.split(';')[0]
    if (part.startsWith('childos_session=')) cookieJar = part
  }
  let json = {}
  const text = await res.text().catch(() => '')
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: res.status, json, headers: res.headers }
}

function clearCookie() {
  cookieJar = ''
}

async function testReadiness() {
  const { status, json } = await request('/api/readiness', undefined, { method: 'GET' })
  const ok =
    status === 200 &&
    json?.ok === true &&
    json?.data?.ready === true &&
    json?.data?.checks?.mockMode === false &&
    json?.data?.checks?.databaseConfigured === true
  record('readiness', ok, {
    message: ok ? 'ready + DB + 非 mock' : `status=${status}`,
    data: json?.data?.checks,
  })
  return ok
}

async function testLoginPageNoAutoRedirect() {
  clearCookie()
  const res = await fetch(`${BASE}/login`, { redirect: 'manual' })
  const ok = res.status === 200
  record('login_page_without_session', ok, {
    message: ok ? '未登录可打开 /login（200）' : `status=${res.status}`,
  })
  return ok
}

async function loginDemo() {
  clearCookie()
  const { status, json } = await request('/api/auth/demo', {})
  const ok = status === 200 && json?.ok && json?.data?.user?.userId
  record('demo_login', ok, {
    message: ok ? `user=${json.data.user.userId}` : JSON.stringify(json?.error || json).slice(0, 120),
  })
  return ok
}

async function loginReal() {
  const phone = process.env.TEST_PHONE
  const password = process.env.TEST_PASSWORD
  if (!phone || !password) return null
  clearCookie()
  let { status, json } = await request('/api/auth/login', { phone, password })
  if (!json?.ok && json?.error?.code === 'BAD_CREDENTIALS') {
    ;({ status, json } = await request('/api/auth/register', { phone, password }))
  }
  const ok = status === 200 && json?.ok && json?.data?.user?.phone
  record('real_login', ok, {
    message: ok ? phone : JSON.stringify(json?.error || json).slice(0, 120),
  })
  return ok
}

async function testMe(expectUser) {
  const { status, json } = await request('/api/auth/me', undefined, { method: 'GET' })
  const hasUser = Boolean(json?.data?.user)
  const ok = status === 200 && json?.ok === true && hasUser === expectUser
  record(expectUser ? 'auth_me_logged_in' : 'auth_me_logged_out', ok, {
    message: expectUser
      ? `phone=${json?.data?.user?.phone} onboarding=${json?.data?.user?.onboardingComplete}`
      : hasUser
        ? '仍有 user，未登出'
        : 'user=null',
    onboardingComplete: json?.data?.user?.onboardingComplete,
  })
  return ok
}

async function testAccountStateRoundtrip() {
  const marker = `lifecycle_test_${Date.now()}`
  const payload = {
    dailyThread: [
      { role: 'parent', text: `${marker} 家长侧测试句` },
      { role: 'ai', text: `${marker} AI 回复测试` },
    ],
    storage: {
      version: 'childos.storage.v1',
      activeFamilyId: 'f_test',
      activeChildId: 'c_test',
      families: [],
      children: [],
      buildSessions: [],
      entryRecords: [],
      followUpRecords: [],
      stageSummaries: [],
      profileSnapshots: [],
      evidenceRecords: [],
      verificationPoints: [],
      dailyObservations: [],
      updatedAt: new Date().toISOString(),
      __lifecycleMarker: marker,
    },
  }
  const post = await request('/api/account/state', payload)
  const postOk = post.status === 200 && post.json?.ok === true
  record('account_state_post', postOk, {
    message: postOk ? '备份已写入' : JSON.stringify(post.json?.error || post.json).slice(0, 120),
  })
  if (!postOk) return false

  const get = await request('/api/account/state', undefined, { method: 'GET' })
  const backup = get.json?.data?.backup
  const markerHit =
    backup?.dailyThread?.some((t) => String(t.text || '').includes(marker)) ||
    backup?.storage?.__lifecycleMarker === marker
  const getOk = get.status === 200 && get.json?.ok && markerHit
  record('account_state_get_roundtrip', getOk, {
    message: getOk
      ? `dailyThread=${backup?.dailyThread?.length ?? 0} updatedAt=${backup?.updatedAt}`
      : '回读未命中 marker',
  })
  return postOk && getOk
}

async function testProfileBuiltRoundtrip() {
  const snapshot = {
    completeness: 88,
    coreJudgment: `生命周期测试画像 ${Date.now()}`,
    deepMechanism: '测试机制链',
    supportFocus: '测试支持重点',
    evidence: [],
    verificationPoints: [],
  }
  const post = await request('/api/profile/built', { snapshot })
  const postOk = post.status === 200 && post.json?.ok
  record('profile_built_post', postOk, {
    message: postOk ? `onboardingComplete=${post.json?.data?.onboardingComplete}` : '写入失败',
  })

  const get = await request('/api/profile/built', undefined, { method: 'GET' })
  const got = get.json?.data?.snapshot?.coreJudgment
  const getOk =
    get.status === 200 &&
    get.json?.ok &&
    typeof got === 'string' &&
    got.includes('生命周期测试画像')
  record('profile_built_get', getOk, {
    message: getOk
      ? `onboardingComplete=${get.json?.data?.onboardingComplete}`
      : '快照未回读',
  })
  return postOk && getOk
}

async function testBuildStatePost() {
  const body = {
    introSeen: true,
    basicInfoDone: true,
    completedEntries: ['daily', 'homework'],
    stageSummaries: [
      {
        entryType: 'daily',
        mainJudgment: '测试阶段总结',
        facts: ['事实1'],
        pendingHypotheses: [],
      },
    ],
  }
  const { status, json } = await request('/api/profile/build-state', body)
  const ok = status === 200 && json?.ok
  record('profile_build_state_post', ok, {
    message: ok ? '四模块进度已写入' : JSON.stringify(json?.error || json).slice(0, 120),
  })
  return ok
}

async function testLogout() {
  const { status, json } = await request('/api/auth/logout', {})
  const ok = status === 200 && json?.ok
  record('logout', ok, { message: ok ? '会话已清除' : 'logout 失败' })
  clearCookie()
  return ok
}

async function testProtectedRouteAfterLogout() {
  const { status } = await request('/api/account/state', undefined, { method: 'GET' })
  const ok = status === 401
  record('protected_api_after_logout', ok, {
    message: ok ? '未登录返回 401' : `status=${status}（应 401）`,
  })
  return ok
}

async function testReloginHydration() {
  const loggedIn = (await loginDemo()) || (await loginReal())
  if (!loggedIn) {
    record('relogin_hydration', false, { message: '无法二次登录' })
    return false
  }
  const get = await request('/api/account/state', undefined, { method: 'GET' })
  const hasBackup = Boolean(get.json?.data?.backup?.updatedAt)
  const built = await request('/api/profile/built', undefined, { method: 'GET' })
  const hasSnapshot = Boolean(built.json?.data?.snapshot?.coreJudgment)
  const me = await request('/api/auth/me', undefined, { method: 'GET' })
  const onboarding = me.json?.data?.user?.onboardingComplete === true
  const ok = hasBackup || hasSnapshot || onboarding
  record('relogin_server_state', ok, {
    message: `backup=${hasBackup} snapshot=${hasSnapshot} onboarding=${onboarding}`,
  })
  return ok
}

function auditUserOnServer(phone) {
  const sshPass = process.env.SSH_PASS
  const sshHost = process.env.SSH_HOST || 'ubuntu@81.70.228.8'
  const sshpass = process.env.SSHPASS_BIN || '/opt/homebrew/bin/sshpass'
  if (!sshPass) {
    record('db_audit_skipped', true, { message: '未设置 SSH_PASS，跳过线上 DB 审计' })
    return true
  }
  try {
    const cmd = `${sshpass} -p ${JSON.stringify(sshPass)} ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no ${sshHost} bash -s`
    const remoteScript = `cd /home/ubuntu/apps/yujian && node <<'NODE'
const fs=require("fs");
const db=fs.readFileSync(".env.local","utf8").match(/DATABASE_URL=(.*)/)?.[1]?.replace(/^"|"$/g,"");
const {Pool}=require("pg");
const pool=new Pool({connectionString:db});
(async()=>{
  const phone=${JSON.stringify(phone)};
  const u=await pool.query("SELECT phone,family_id,child_id,onboarding_complete FROM users WHERE phone=$1",[phone]);
  const row=u.rows[0];
  if(!row){ console.log(JSON.stringify({found:false})); await pool.end(); return; }
  const layers=await pool.query("SELECT layer_name, count(*)::int c FROM memory_layer_items WHERE family_id=$1 AND child_id=$2 GROUP BY 1",[row.family_id,row.child_id]);
  const conv=await pool.query("SELECT count(*)::int c FROM conversations WHERE family_id=$1 AND child_id=$2",[row.family_id,row.child_id]);
  console.log(JSON.stringify({found:true,phone:row.phone,onboarding_complete:row.onboarding_complete,conversations:conv.rows[0].c,layers:layers.rows}));
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1);});
NODE`
    const out = execSync(cmd, { encoding: 'utf8', timeout: 25000, input: remoteScript, shell: '/bin/bash' }).trim()
    const data = JSON.parse(out.split('\n').pop())
    if (!data.found) {
      record('db_audit_user', false, { message: `未找到用户 ${phone}` })
      return false
    }
    const layerNames = (data.layers || []).map((l) => l.layer_name)
    const hasBackup = layerNames.includes('account_client_backup')
    const hasBuilt = layerNames.includes('built_profile_snapshots')
    const ok = data.onboarding_complete === true
    record('db_audit_user', ok, {
      message: `onboarding=${data.onboarding_complete} conv=${data.conversations} backup=${hasBackup} built=${hasBuilt}`,
      data,
    })
    return ok
  } catch (e) {
    record('db_audit_user', false, { message: String(e.message || e).slice(0, 200) })
    return false
  }
}

async function main() {
  console.log(`\n=== 账号生命周期测试 @ ${BASE} ===\n`)

  await testReadiness()
  await testLoginPageNoAutoRedirect()

  const realOk = await loginReal()
  if (!realOk) await loginDemo()

  await testMe(true)
  await testAccountStateRoundtrip()
  await testBuildStatePost()
  await testProfileBuiltRoundtrip()
  await testLogout()
  await testMe(false)
  await testProtectedRouteAfterLogout()
  await testLoginPageNoAutoRedirect()
  await testReloginHydration()

  auditUserOnServer(AUDIT_PHONE)

  report.meta.finishedAt = new Date().toISOString()
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`\n=== 结果: ${report.summary.ok}/${report.summary.total} 通过 ===`)
  console.log(`报告: ${REPORT_PATH}\n`)

  if (report.summary.fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})

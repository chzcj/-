#!/usr/bin/env node
/**
 * 记忆层 + 检索链路全面审计
 *
 * 用法:
 *   SSH_PASS=xxx node scripts/audit-memory-retrieval.mjs
 *   AUDIT_PHONE=13017552641 TEST_BASE_URL=https://yujian.yihe.site node scripts/audit-memory-retrieval.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PHONE = process.env.AUDIT_PHONE || '13017552641'
const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'
const SSH_PASS = process.env.SSH_PASS
const SSH_HOST = process.env.SSH_HOST || 'ubuntu@81.70.228.8'
const SSHPASS = process.env.SSHPASS_BIN || '/opt/homebrew/bin/sshpass'

const report = {
  meta: { phone: PHONE, base: BASE, at: new Date().toISOString() },
  checks: [],
  summary: { pass: 0, fail: 0, warn: 0 },
}

function record(name, status, detail = {}) {
  report.checks.push({ name, status, ...detail })
  if (status === 'pass') report.summary.pass += 1
  else if (status === 'fail') report.summary.fail += 1
  else report.summary.warn += 1
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️'
  console.log(`${icon} ${name}${detail.message ? ` — ${detail.message}` : ''}`)
}

function runRemoteAudit(phone) {
  if (!SSH_PASS) {
    record('remote_db', 'warn', { message: '未设置 SSH_PASS，跳过远程 DB 审计' })
    return null
  }
  const remoteScript = `cd /home/ubuntu/apps/yujian && node <<'NODE'
const fs=require('fs');
const pg=require('pg');
const db=fs.readFileSync('.env.local','utf8').match(/DATABASE_URL=(.*)/)[1].replace(/^"|"$/g,'');
const pool=new pg.Pool({connectionString:db});
(async()=>{
  const phone=${JSON.stringify(phone)};
  const u=await pool.query('SELECT user_id,family_id,child_id,onboarding_complete FROM users WHERE phone=$1',[phone]);
  if(!u.rows[0]){ console.log(JSON.stringify({found:false})); await pool.end(); return; }
  const {family_id,child_id,onboarding_complete}=u.rows[0];
  const layers=await pool.query(
    'SELECT layer_name, count(*)::int c FROM memory_layer_items WHERE family_id=$1 AND child_id=$2 GROUP BY 1 ORDER BY 1',
    [family_id,child_id]
  );
  const dailyRows=await pool.query(
    "SELECT data->>'newInput' AS text, data->>'timestamp' AS ts, data->>'sourceEventId' AS trace FROM memory_layer_items WHERE family_id=$1 AND child_id=$2 AND layer_name='daily_updates' ORDER BY updated_at ASC LIMIT 20",
    [family_id,child_id]
  );
  const turnRows=await pool.query(
    "SELECT data->>'userMessage' AS text, data->>'traceId' AS trace, data->>'createdAt' AS ts FROM memory_layer_items WHERE family_id=$1 AND child_id=$2 AND layer_name='turn_events' ORDER BY updated_at ASC LIMIT 20",
    [family_id,child_id]
  );
  const jobs=await pool.query(
    "SELECT job_type, status, count(*)::int c FROM job_queue WHERE trace_id IS NOT NULL AND payload::text LIKE $1 GROUP BY 1,2 ORDER BY 1,2",
    ['%'+family_id+'%']
  );
  const built=await pool.query(
    "SELECT left(data->>'coreJudgment',120) AS core, left(data->>'deepMechanism',80) AS deep FROM memory_layer_items WHERE family_id=$1 AND child_id=$2 AND layer_name='built_profile_snapshots' LIMIT 1",
    [family_id,child_id]
  );
  const episodes=await pool.query('SELECT count(*)::int c FROM evidence_episodes WHERE family_id=$1 AND child_id=$2',[family_id,child_id]);
  const atoms=await pool.query('SELECT count(*)::int c FROM fact_atoms WHERE family_id=$1 AND child_id=$2',[family_id,child_id]);
  let failedJobs=0;
  try {
    const fj=await pool.query("SELECT count(*)::int c FROM job_queue WHERE status='failed' AND payload::text LIKE $1",['%'+family_id+'%']);
    failedJobs=fj.rows[0].c;
  } catch { failedJobs=-1; }
  console.log(JSON.stringify({
    found:true, family_id, child_id, onboarding_complete,
    layers:layers.rows,
    dailySamples:dailyRows.rows,
    turnSamples:turnRows.rows,
    builtSnapshot:built.rows[0]||null,
    episodes:episodes.rows[0].c,
    atoms:atoms.rows[0].c,
    failedJobs,
    jobStats:jobs.rows,
  }));
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1);});
NODE`
  const host = SSH_HOST.includes('@') ? SSH_HOST.split('@')[1] : SSH_HOST
  const cmd = `${SSHPASS} -p ${JSON.stringify(SSH_PASS)} ssh -o StrictHostKeyChecking=no ubuntu@${host} bash -s`
  const out = execSync(cmd, { encoding: 'utf8', timeout: 60000, input: remoteScript, shell: '/bin/bash' })
  return JSON.parse(out.trim().split('\n').pop())
}

async function login(phone, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: new URL(BASE).origin },
    body: JSON.stringify({ phone, password }),
  })
  const json = await res.json().catch(() => ({}))
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const cookie = cookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('childos_session=')) || ''
  return { ok: json?.ok === true, cookie, user: json?.data?.user }
}

async function streamDaily(cookie, text) {
  const res = await fetch(`${BASE}/api/daily/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      Origin: new URL(BASE).origin,
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(120_000),
  })
  const reader = res.body?.getReader()
  if (!reader) return null
  const dec = new TextDecoder()
  let buf = ''
  let final = null
  let traceId = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      try {
        const e = JSON.parse(line)
        if (e.type === 'start' && e.traceId) traceId = e.traceId
        if (e.type === 'final') final = { ...e, traceId: e.traceId || traceId }
      } catch {
        /* ignore */
      }
    }
  }
  return final
}

async function fetchReadiness() {
  try {
    const res = await fetch(`${BASE}/api/readiness`)
    const json = await res.json()
    return json?.data || null
  } catch {
    return null
  }
}

async function main() {
  console.log(`\n=== 记忆检索审计 @ ${BASE} · ${PHONE} ===\n`)

  const readiness = await fetchReadiness()
  if (readiness) {
    record('fast_ai_configured', readiness.checks?.fastConfigured ? 'pass' : 'fail', {
      message: readiness.checks?.fastConfigured ? 'FAST_AI 已配置' : 'FAST_AI 未配置，prose/enrich 将走规则降级',
    })
    record('embedding_configured', readiness.checks?.embeddingConfigured ? 'pass' : 'warn', {
      message: readiness.checks?.embeddingConfigured ? 'embedding 已配置' : 'embedding 未配置，向量检索降级',
    })
    record('database_ready', readiness.checks?.database?.enabled && !readiness.checks?.database?.error ? 'pass' : 'fail', {
      message: readiness.ready ? 'readiness=ready' : 'readiness 未就绪',
    })
    record('mock_mode', readiness.checks?.mockMode ? 'warn' : 'pass', {
      message: readiness.checks?.mockMode ? 'NEXT_PUBLIC_USE_MOCK=true，数据可能不落库' : '非 mock 模式',
    })
  } else {
    record('readiness_probe', 'warn', { message: '无法访问 /api/readiness' })
  }

  const remote = runRemoteAudit(PHONE)
  if (remote?.found) {
    const layerMap = Object.fromEntries((remote.layers || []).map((l) => [l.layer_name, l.c]))
    record('daily_updates_layer', layerMap.daily_updates > 0 ? 'pass' : 'fail', {
      message: `count=${layerMap.daily_updates || 0}`,
    })
    record('turn_events_layer', layerMap.turn_events > 0 ? 'pass' : 'fail', {
      message: `count=${layerMap.turn_events || 0}`,
    })
    record('built_snapshot', remote.builtSnapshot?.core ? 'pass' : 'warn', {
      message: remote.builtSnapshot?.core?.slice(0, 48) || '无快照',
    })
    if (remote.builtSnapshot?.core && /测试画像|生命周期测试/i.test(remote.builtSnapshot.core)) {
      record('built_snapshot_placeholder', 'fail', {
        message: 'DB 仍存在占位画像标题，请运行 migrate-humanize-profile-titles',
      })
    }
    record('evidence_episodes', remote.episodes > 0 ? 'pass' : 'warn', {
      message: `episodes=${remote.episodes} atoms=${remote.atoms}`,
    })
    record('job_queue_failed', remote.failedJobs === 0 ? 'pass' : 'warn', {
      message: `failed=${remote.failedJobs}`,
    })
    const memJobs = (remote.jobStats || []).filter((j) => j.job_type === 'memory_write')
    const memDone = memJobs.find((j) => j.status === 'succeeded')?.c || 0
    record('memory_write_jobs', memDone > 0 ? 'pass' : 'warn', {
      message: `memory_write done=${memDone}`,
      stats: remote.jobStats,
    })

    const dailyTexts = (remote.dailySamples || []).map((r) => r.text).filter(Boolean)
    const turnTexts = (remote.turnSamples || []).map((r) => r.text).filter(Boolean)
    record('daily_input_samples', dailyTexts.length > 0 ? 'pass' : 'fail', {
      message: `${dailyTexts.length} 条样本`,
      samples: dailyTexts.slice(-3),
    })
    record('turn_event_samples', turnTexts.length > 0 ? 'pass' : 'fail', {
      message: `${turnTexts.length} 条样本`,
      samples: turnTexts.slice(-3),
    })

    // 检索召回：用历史输入片段作为 query，看 history_thinking / evidence 是否含相关词
    const password = process.env.TEST_PASSWORD || process.env.AUDIT_PASSWORD
    if (password && dailyTexts.length > 0) {
      const { ok, cookie } = await login(PHONE, password)
      if (ok) {
        const probe = dailyTexts[dailyTexts.length - 1]
        const keyword = probe.slice(0, 12)
        let final = null
        try {
          final = await streamDaily(cookie, `继续聊：${probe.slice(0, 40)}`)
        } catch (err) {
          record('retrieval_recall_probe', 'warn', {
            message: `stream 超时或失败: ${err instanceof Error ? err.message : String(err)}`,
          })
        }
        if (final) {
        const sectionBlob = JSON.stringify(final?.sections || [])
        const cardsBlob = JSON.stringify(final?.cards || {})
        const hit = sectionBlob.includes(keyword.slice(0, 6)) || cardsBlob.includes(keyword.slice(0, 6))
        record('retrieval_recall_probe', hit ? 'pass' : 'warn', {
          message: hit ? `sections/cards 含历史片段「${keyword.slice(0, 8)}…」` : '未在 sections 中命中历史片段（可能语义改写）',
          sectionIds: (final?.sections || []).map((s) => s.id),
        })

        const runtime = final?.runtime || {}
        record('llm_prose_used', runtime.llmProseUsed ? 'pass' : 'warn', {
          message: runtime.llmProseUsed ? '本轮 prose 来自 LLM' : '本轮 prose 为规则降级',
          runtime,
        })
        record('memory_retrieval_used', runtime.retrievalUsed ? 'pass' : 'warn', {
          message: runtime.retrievalUsed
            ? `检索命中 episodes=${runtime.retrievalEpisodeCount || 0}`
            : '本轮未命中历史检索包（可能是新用户或记忆为空）',
        })

        if (final?.traceId) {
          record('trace_id_present', 'pass', { message: final.traceId })
        } else {
          record('trace_id_present', 'fail', { message: 'stream 未返回 traceId' })
        }

        const uiOk =
          Boolean(final?.text) &&
          Array.isArray(final?.sections) &&
          final.sections.length > 0 &&
          Array.isArray(final?.actions) &&
          final.actions.length > 0
        record('daily_stream_ui_payload', uiOk ? 'pass' : 'fail', {
          message: `prose=${(final?.text || '').length}字 sections=${final?.sections?.length || 0} actions=${final?.actions?.length || 0}`,
        })
        }
      } else {
        record('retrieval_recall_probe', 'warn', { message: '登录失败，跳过在线召回探测' })
      }
    } else {
      record('retrieval_recall_probe', 'warn', { message: '未设置 TEST_PASSWORD，跳过在线召回' })
    }
  }

  const outPath = path.join(ROOT, 'scripts/test-reports', `memory-retrieval-audit-${Date.now()}.json`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\n报告: ${outPath}`)
  console.log(`结果: ${report.summary.pass} pass / ${report.summary.fail} fail / ${report.summary.warn} warn\n`)
  if (report.summary.fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

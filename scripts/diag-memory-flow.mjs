// 诊断脚本：验证记忆读写全链路是否真的把四模块采集传到了 AI 上下文
// 在服务器上跑：DATABASE_URL=... node scripts/diag-memory-flow.mjs
import pg from 'pg'

const u = process.env.DATABASE_URL
if (!u) { console.error('no DATABASE_URL'); process.exit(1) }
const pool = new pg.Pool({ connectionString: u, max: 2 })
const q = (sql, params = []) => pool.query(sql, params)

console.log('\n=== 1. 各租户 memory_layer_items 计数（按 family_id / layer_name）===')
const layers = await q(`
  SELECT family_id, layer_name, count(*)::int AS n
  FROM memory_layer_items
  GROUP BY family_id, layer_name
  ORDER BY family_id, layer_name
`)
const byFam = {}
for (const r of layers.rows) (byFam[r.family_id] ||= {})[r.layer_name] = r.n
for (const fam of Object.keys(byFam)) console.log(`  ${fam}: ${JSON.stringify(byFam[fam])}`)

// 2. 找一个有 entry_evidence_packs 的租户
const packFam = layers.rows.find(r => r.layer_name === 'entry_evidence_packs' && r.n > 0)
if (!packFam) {
  console.log('\n!! 没有任何租户有 entry_evidence_packs —— 四模块采集从未真正落库')
} else {
  const fam = packFam.family_id
  console.log(`\n=== 2. 选取 family=${fam}（entry_evidence_packs=${packFam.n}）===`)

  // 3. 查该租户最近 turn_event 的 retrievedContextSnapshot（实际喂给 LLM 的上下文）
  console.log('\n=== 3. 最近 3 条 turn_events 的 retrievedContextSnapshot 关键字段（实际喂给 AI 的上下文）===')
  const turns = await q(`
    SELECT item_id AS trace_id, data->>'createdAt' AS at,
      length(data->>'userMessage') AS user_len,
      length(data->>'assistantReply') AS reply_len,
      data->'retrievedContextSnapshot' AS ctx
    FROM memory_layer_items
    WHERE layer_name = 'turn_events' AND family_id = $1
    ORDER BY (data->>'createdAt') DESC LIMIT 3
  `, [fam])
  if (turns.rows.length === 0) console.log('  该租户无 turn_events（从未在交流页聊过）')
  for (const t of turns.rows) {
    const ctx = t.ctx || {}
    console.log(`\n  --- trace ${t.trace_id} @ ${t.at} (user_len=${t.user_len}, reply_len=${t.reply_len}) ---`)
    console.log(`    relevantChildStructureModel   : ${JSON.stringify(ctx.relevantChildStructureModel || []).slice(0, 220)}`)
    console.log(`    relevantEntryEvidencePacks    : ${JSON.stringify(ctx.relevantEntryEvidencePacks || []).slice(0, 300)}`)
    console.log(`    relevantPastEvents            : ${JSON.stringify(ctx.relevantPastEvents || []).slice(0, 220)}`)
    console.log(`    relevantPendingHypotheses     : ${JSON.stringify(ctx.relevantPendingHypotheses || []).slice(0, 200)}`)
    console.log(`    childQuotes                   : ${JSON.stringify(ctx.childQuotes || []).slice(0, 200)}`)
    console.log(`    matchedMechanisms             : ${JSON.stringify(ctx.matchedMechanisms || []).slice(0, 160)}`)
    console.log(`    relevantFamilyInteractionPatterns: ${JSON.stringify(ctx.relevantFamilyInteractionPatterns || []).slice(0, 200)}`)
    console.log(`    parentNarrativePattern        : ${JSON.stringify(ctx.parentNarrativePattern || []).slice(0, 200)}`)
  }

  // 4. entry_evidence_packs 实际内容
  console.log('\n=== 4. entry_evidence_packs 实际内容片段（四模块采集到了什么）===')
  const packs = await q(`
    SELECT data->>'entryType' AS entry_type,
      data->'decomposedInput'->'childQuotes' AS child_quotes,
      data->'decomposedInput'->'facts' AS facts,
      data->'decomposedInput'->'parentActions' AS parent_actions
    FROM memory_layer_items
    WHERE layer_name = 'entry_evidence_packs' AND family_id = $1
    LIMIT 5
  `, [fam])
  for (const p of packs.rows) {
    console.log(`  [${p.entry_type}]`)
    console.log(`    facts        : ${(JSON.stringify(p.facts || [])).slice(0, 180)}`)
    console.log(`    childQuotes  : ${(JSON.stringify(p.child_quotes || [])).slice(0, 120)}`)
    console.log(`    parentActions: ${(JSON.stringify(p.parent_actions || [])).slice(0, 120)}`)
  }
}

// 5. job_queue 全局
console.log('\n=== 5. job_queue 全局状态（排除心跳行）===')
const jobs = await q(`
  SELECT job_type, status, count(*)::int AS n FROM job_queue
  WHERE job_type <> '__heartbeat__'
  GROUP BY job_type, status ORDER BY job_type, status
`)
if (jobs.rows.length === 0) console.log('  （无 job 记录，job_queue 从未真正使用过）')
for (const j of jobs.rows) console.log(`  ${j.job_type} / ${j.status}: ${j.n}`)

const hb = await q(`SELECT updated_at FROM job_queue WHERE idempotency_key = 'heartbeat:job_worker'`)
console.log(`  worker heartbeat: ${hb.rows[0]?.updated_at || 'none（worker 未在跑）'}`)

// 6. entry_evidence job 执行情况
console.log('\n=== 6. entry_evidence job 执行情况（是否真的 succeeded，不只是入队）===')
const entryJobs = await q(`
  SELECT status, count(*)::int AS n, max(updated_at) AS last_at
  FROM job_queue WHERE job_type = 'entry_evidence'
  GROUP BY status
`)
if (entryJobs.rows.length === 0) console.log('  （从未入队 entry_evidence job）')
for (const j of entryJobs.rows) console.log(`  entry_evidence / ${j.status}: ${j.n} (last ${j.last_at})`)

// 7. daily_updates 是否真有内容
console.log('\n=== 7. daily_updates 计数（日常交流写入的 L9 层）===')
const du = await q(`SELECT family_id, count(*)::int AS n FROM memory_layer_items WHERE layer_name='daily_updates' GROUP BY family_id`)
if (du.rows.length === 0) console.log('  （无 daily_updates —— 日常交流 memory_write 从未落库）')
for (const r of du.rows) console.log(`  ${r.family_id}: ${r.n} 条`)

await pool.end()

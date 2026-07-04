// 深查 f_demo：四模块采集内容 + 交流时实际喂给 AI 的上下文
import pg from 'pg'
const u = process.env.DATABASE_URL
if (!u) { console.error('no DATABASE_URL'); process.exit(1) }
const pool = new pg.Pool({ connectionString: u, max: 2 })
const q = (sql, params = []) => pool.query(sql, params)

const FAM = process.env.FAM || 'f_demo'
console.log(`\n===== 深查 family=${FAM} =====`)

// A. entry_evidence_packs 完整结构
console.log('\n=== A. entry_evidence_packs 完整 decomposedInput ===')
const packs = await q(`
  SELECT item_id, data
  FROM memory_layer_items
  WHERE layer_name = 'entry_evidence_packs' AND family_id = $1
`, [FAM])
console.log(`共 ${packs.rows.length} 个 pack`)
for (const p of packs.rows) {
  const d = p.data
  const di = d?.decomposedInput || {}
  console.log(`\n  [pack ${p.item_id}] entryType=${d?.entryType || d?.entry || '(missing)'}`)
  console.log(`    facts         : ${JSON.stringify(di.facts || []).slice(0, 300)}`)
  console.log(`    childQuotes   : ${JSON.stringify(di.childQuotes || []).slice(0, 200)}`)
  console.log(`    parentActions : ${JSON.stringify(di.parentActions || []).slice(0, 200)}`)
  console.log(`    triggerPoints : ${JSON.stringify(di.triggerPoints || []).slice(0, 200)}`)
  console.log(`    missingInfo   : ${JSON.stringify((d?.decomposedInput?.missingInformation || di.missingInformation) || []).slice(0, 160)}`)
  // 也看顶层是否有 mainJudgment / facts
  console.log(`    top keys      : ${Object.keys(d || {}).join(',')}`)
  console.log(`    top.facts     : ${JSON.stringify(d?.facts || []).slice(0, 160)}`)
  console.log(`    top.mainJudgment: ${(d?.mainJudgment || '').slice(0, 160)}`)
}

// B. 最近 5 条 turn_event 的实际 AI 上下文
console.log('\n=== B. 最近 5 条 turn_events 实际喂给 AI 的 retrievedContextSnapshot ===')
const turns = await q(`
  SELECT item_id AS trace_id, data->>'createdAt' AS at,
    data->>'userMessage' AS user_msg,
    data->>'assistantReply' AS reply,
    data->'retrievedContextSnapshot' AS ctx,
    data->'relationshipToExistingModel'->>'type' AS rel
  FROM memory_layer_items
  WHERE layer_name = 'turn_events' AND family_id = $1
  ORDER BY (data->>'createdAt') DESC LIMIT 5
`, [FAM])
for (const t of turns.rows) {
  const ctx = t.ctx || {}
  console.log(`\n  --- trace ${t.trace_id} @ ${t.at} | rel=${t.rel} ---`)
  console.log(`    user: ${(t.user_msg || '').slice(0, 80)}`)
  console.log(`    reply: ${(t.reply || '').slice(0, 80)}`)
  console.log(`    relevantChildStructureModel   : ${JSON.stringify(ctx.relevantChildStructureModel || []).slice(0, 240)}`)
  console.log(`    relevantEntryEvidencePacks    : ${JSON.stringify(ctx.relevantEntryEvidencePacks || []).slice(0, 300)}`)
  console.log(`    relevantPastEvents            : ${JSON.stringify(ctx.relevantPastEvents || []).slice(0, 220)}`)
  console.log(`    relevantPendingHypotheses     : ${JSON.stringify(ctx.relevantPendingHypotheses || []).slice(0, 200)}`)
  console.log(`    childQuotes                   : ${JSON.stringify(ctx.childQuotes || []).slice(0, 200)}`)
  console.log(`    matchedMechanisms             : ${JSON.stringify(ctx.matchedMechanisms || []).slice(0, 160)}`)
  console.log(`    relevantFamilyInteractionPatterns: ${JSON.stringify(ctx.relevantFamilyInteractionPatterns || []).slice(0, 200)}`)
}

// C. built_profile_snapshots
console.log('\n=== C. built_profile_snapshots（画像快照）===')
const built = await q(`SELECT data->>'coreJudgment' AS cj, data->>'supportFocus' AS sf, data->>'completeness' AS comp FROM memory_layer_items WHERE layer_name='built_profile_snapshots' AND family_id=$1 ORDER BY (data->>'createdAt') DESC LIMIT 1`, [FAM])
console.log(`  coreJudgment: ${(built.rows[0]?.cj || '').slice(0, 200)}`)
console.log(`  supportFocus: ${(built.rows[0]?.sf || '').slice(0, 200)}`)
console.log(`  completeness: ${built.rows[0]?.comp}`)

await pool.end()

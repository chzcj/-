// 用正确字段名 dump f_demo entry_evidence_packs 完整 decomposedInput
import pg from 'pg'
const u = process.env.DATABASE_URL
if (!u) { console.error('no DATABASE_URL'); process.exit(1) }
const pool = new pg.Pool({ connectionString: u, max: 2 })
const q = (sql, params = []) => pool.query(sql, params)

const FAM = process.env.FAM || 'f_demo'
const packs = await q(`
  SELECT item_id, data
  FROM memory_layer_items
  WHERE layer_name = 'entry_evidence_packs' AND family_id = $1
`, [FAM])
console.log(`\n===== ${FAM} 共 ${packs.rows.length} 个 entry_evidence_packs =====`)
for (const p of packs.rows) {
  const d = p.data
  const di = d?.decomposedInput || {}
  console.log(`\n[item_id=${p.item_id}] packId=${d?.packId} entryName=${d?.entryName}`)
  console.log(`  rawInputSummary: ${(d?.rawInputSummary || '').slice(0, 160)}`)
  console.log(`  decomposedInput:`)
  console.log(`    verifiableFacts : ${JSON.stringify(di.verifiableFacts || []).slice(0, 300)}`)
  console.log(`    childBehaviors  : ${JSON.stringify(di.childBehaviors || []).slice(0, 200)}`)
  console.log(`    childQuotes     : ${JSON.stringify(di.childQuotes || []).slice(0, 200)}`)
  console.log(`    parentQuotes    : ${JSON.stringify(di.parentQuotes || []).slice(0, 160)}`)
  console.log(`    parentActions   : ${JSON.stringify(di.parentActions || []).slice(0, 200)}`)
  console.log(`    triggerPoints   : ${JSON.stringify(di.triggerPoints || []).slice(0, 200)}`)
  console.log(`    parentGoals     : ${JSON.stringify(di.parentGoals || []).slice(0, 160)}`)
  console.log(`    missingInformation: ${JSON.stringify(di.missingInformation || []).slice(0, 200)}`)
  console.log(`    parentEvaluations: ${JSON.stringify(di.parentEvaluations || []).slice(0, 160)}`)
  const mechs = (d?.candidateMechanisms || []).map(m => m?.mechanismName)
  console.log(`  candidateMechanisms: ${JSON.stringify(mechs).slice(0, 200)}`)
  console.log(`  handoffToSummaryAgent.mostImportantEvidence: ${JSON.stringify(d?.handoffToSummaryAgent?.mostImportantEvidence || []).slice(0, 160)}`)
}

// 也查另一个有 parentActions 的家庭做对照
console.log(`\n===== 对照：fam_1781700316491_vwckig 的 entry packs =====`)
const packs2 = await q(`SELECT item_id, data FROM memory_layer_items WHERE layer_name='entry_evidence_packs' AND family_id='fam_1781700316491_vwckig'`)
for (const p of packs2.rows) {
  const d = p.data, di = d?.decomposedInput || {}
  console.log(`\n[item_id=${p.item_id}] packId=${d?.packId} entryName=${d?.entryName}`)
  console.log(`  rawInputSummary: ${(d?.rawInputSummary || '').slice(0, 160)}`)
  console.log(`    verifiableFacts : ${JSON.stringify(di.verifiableFacts || []).slice(0, 250)}`)
  console.log(`    childQuotes     : ${JSON.stringify(di.childQuotes || []).slice(0, 160)}`)
  console.log(`    parentActions   : ${JSON.stringify(di.parentActions || []).slice(0, 200)}`)
  console.log(`    childBehaviors  : ${JSON.stringify(di.childBehaviors || []).slice(0, 200)}`)
}
await pool.end()

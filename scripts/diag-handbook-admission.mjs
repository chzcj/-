// 手账准入率摸底（需 DATABASE_URL）
// 运行：npx tsx scripts/diag-handbook-admission.mjs [familyId] [childId]

import pg from 'pg'

const familyId = process.argv[2] || 'f_demo'
const childId = process.argv[3] || 'c_demo'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('DATABASE_URL 未设置，跳过 DB 摸底')
    process.exit(0)
  }
  const pool = new pg.Pool({ connectionString: url, max: 2 })
  try {
    const [turns, atoms, rehearsal, pages, pagesLayer] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS count FROM memory_layer_items
         WHERE layer_name='turn_events' AND family_id=$1 AND child_id=$2`,
        [familyId, childId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM fact_atoms
         WHERE family_id=$1 AND child_id=$2 AND is_high_value=TRUE`,
        [familyId, childId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM memory_layer_items
         WHERE layer_name='turn_events' AND family_id=$1 AND child_id=$2
         AND (data->>'mode' ILIKE '%rehearsal%' OR data->>'mode' ILIKE '%预演%')`,
        [familyId, childId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM memory_layer_items
         WHERE layer_name='family_handbook_pages' AND family_id=$1 AND child_id=$2`,
        [familyId, childId]
      ),
      pool.query(
        `SELECT data->>'weekKey' AS week_key, COUNT(*)::int AS n
         FROM memory_layer_items
         WHERE layer_name='family_handbook_pages' AND family_id=$1 AND child_id=$2
         GROUP BY data->>'weekKey'
         ORDER BY week_key DESC LIMIT 6`,
        [familyId, childId]
      ),
    ])

    const turnCount = turns.rows[0]?.count ?? 0
    const atomCount = atoms.rows[0]?.count ?? 0
    const rehearsalCount = rehearsal.rows[0]?.count ?? 0
    const pageCount = pages.rows[0]?.count ?? 0

    console.log(`\n=== 手账准入摸底：${familyId}/${childId} ===\n`)
    console.log('| 指标 | 数量 | 说明 |')
    console.log('|------|------|------|')
    console.log(`| turn_events | ${turnCount} | 日常交流（**不直接**进手账） |`)
    console.log(`| 预演 turn | ${rehearsalCount} | 可准入 rehearsal_voice |`)
    console.log(`| 高价值 atom | ${atomCount} | 可准入 episode_atom |`)
    console.log(`| 已准入页 family_handbook_pages | ${pageCount} | 终身累计 pageCount |`)
    console.log(`| 旧逻辑（全 turn 进 feed） | ${turnCount} | 已废弃 |`)

    if (pagesLayer.rows.length) {
      console.log('\n按 weekKey 分布（最近 6 周）：')
      for (const r of pagesLayer.rows) {
        console.log(`  ${r.week_key || '—'}: ${r.n} 页`)
      }
    } else {
      console.log('\n尚无 family_handbook_pages → 跑 npx tsx scripts/backfill-handbook-pages.mjs')
    }

    console.log('\n建议：若 pageCount=0 且 atom/预演>0，执行 backfill-handbook-pages.mjs')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

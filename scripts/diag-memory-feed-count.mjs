#!/usr/bin/env node
/**
 * 手账记忆 feed 条数摸底（全历史 vs 本周）
 * 运行：npx tsx scripts/diag-memory-feed-count.mjs [familyId] [childId]
 */
import pg from 'pg'

const familyId = process.argv[2] || 'f_demo'
const childId = process.argv[3] || 'c_demo'

function weekKeyFromDate(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay() || 7
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - day + 1)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${y}-W${m}-${dd}`
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('DATABASE_URL 未设置，跳过')
    process.exit(0)
  }
  const pool = new pg.Pool({ connectionString: url, max: 2 })
  const weekKey = weekKeyFromDate()

  try {
    const [allPages, weekPages, hvAtoms, feedSnap] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS count FROM memory_layer_items
         WHERE layer_name='family_handbook_pages' AND family_id=$1 AND child_id=$2`,
        [familyId, childId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM memory_layer_items
         WHERE layer_name='family_handbook_pages' AND family_id=$1 AND child_id=$2
         AND data->>'weekKey' = $3`,
        [familyId, childId, weekKey]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM fact_atoms
         WHERE family_id=$1 AND child_id=$2 AND is_high_value=TRUE`,
        [familyId, childId]
      ),
      pool.query(
        `SELECT data FROM memory_layer_items
         WHERE layer_name='family_memory_feed' AND family_id=$1 AND child_id=$2
         ORDER BY updated_at DESC LIMIT 1`,
        [familyId, childId]
      ),
    ])

    const all = allPages.rows[0]?.count ?? 0
    const week = weekPages.rows[0]?.count ?? 0
    const atoms = hvAtoms.rows[0]?.count ?? 0
    let snapCount = 0
    const snap = feedSnap.rows[0]?.data
    if (snap?.items && Array.isArray(snap.items)) snapCount = snap.items.length

    console.log(`\n=== 手账记忆 feed：${familyId}/${childId} ===\n`)
    console.log(`当前 weekKey（周一锚）: ${weekKey}`)
    console.log(`| 指标 | 数量 | 说明 |`)
    console.log(`|------|------|------|`)
    console.log(`| 全历史准入页 | ${all} | memoryFeed 应展示（不限本周） |`)
    console.log(`| 本周准入页 | ${week} | 旧逻辑仅本周 |`)
    console.log(`| 高价值 atom | ${atoms} | episode_atom 候选 |`)
    console.log(`| feed 快照条数 | ${snapCount} | family_memory_feed 最近快照 |`)
    console.log(`\n期望：回填后 memoryFeed.length ≈ ${all}（全历史），而非 ${week}`)
    if (all === 0 && atoms > 0) {
      console.log('\n⚠ pageCount=0 但有 HV atom → 跑 backfill-handbook-pages.mjs')
    }
    if (snapCount > 0 && snapCount < all) {
      console.log(`\n⚠ 快照 ${snapCount} < 全历史 ${all} → 需部署 buildMemoryFeedAll 后刷新 pack`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

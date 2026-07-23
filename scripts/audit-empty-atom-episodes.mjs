#!/usr/bin/env node
/**
 * 空 atom episode 审计：抽样 extractor 产出 vs 存储
 * 运行：npx tsx scripts/audit-empty-atom-episodes.mjs [familyId] [childId] [limit]
 */
import pg from 'pg'

const familyId = process.argv[2] || 'fam_1783439265597_luqfco'
const childId = process.argv[3] || 'child_1783439265597_omvbu6'
const limit = Number(process.argv[4] || 8)

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('DATABASE_URL 未设置')
    process.exit(0)
  }
  const pool = new pg.Pool({ connectionString: url, max: 2 })
  try {
    const stats = await pool.query(
      `SELECT
         COUNT(*)::int AS ep_total,
         COUNT(*) FILTER (WHERE atom_n = 0)::int AS ep_zero,
         ROUND(100.0 * COUNT(*) FILTER (WHERE atom_n = 0) / NULLIF(COUNT(*),0), 1) AS zero_pct
       FROM (
         SELECT e.episode_id, COUNT(a.atom_id)::int AS atom_n
         FROM evidence_episodes e
         LEFT JOIN fact_atoms a ON a.episode_id = e.episode_id
         WHERE e.family_id = $1 AND e.child_id = $2
         GROUP BY e.episode_id
       ) x`,
      [familyId, childId]
    )
    const s = stats.rows[0]
    console.log(`\n=== 空 atom episode 审计：${familyId}/${childId} ===\n`)
    console.log(`Episode 总计: ${s.ep_total}，空 atom: ${s.ep_zero}（${s.zero_pct}%）\n`)

    const samples = await pool.query(
      `SELECT e.episode_id, e.summary, e.source_event_id, e.source_created_at,
              COUNT(a.atom_id)::int AS atom_n
       FROM evidence_episodes e
       LEFT JOIN fact_atoms a ON a.episode_id = e.episode_id
       WHERE e.family_id = $1 AND e.child_id = $2
       GROUP BY e.episode_id, e.summary, e.source_event_id, e.source_created_at
       HAVING COUNT(a.atom_id) = 0
       ORDER BY e.source_created_at DESC
       LIMIT $3`,
      [familyId, childId, limit]
    )

    if (!samples.rows.length) {
      console.log('✓ 无空 atom episode（或已修复）')
      return
    }

    console.log(`【抽样 ${samples.rows.length} 条空 atom episode】\n`)
    for (const row of samples.rows) {
      const traceId = row.source_event_id
      let turnText = ''
      if (traceId) {
        const turn = await pool.query(
          `SELECT data->>'userMessage' AS msg, data->>'mode' AS mode
           FROM memory_layer_items
           WHERE layer_name='turn_events' AND family_id=$1 AND child_id=$2
           AND (data->>'traceId' = $3 OR data->>'sourceEventId' = $3)
           LIMIT 1`,
          [familyId, childId, traceId]
        )
        turnText = turn.rows[0]?.msg || ''
      }

      console.log('—'.repeat(60))
      console.log(`episode_id: ${row.episode_id}`)
      console.log(`created: ${row.source_created_at}`)
      console.log(`trace/source: ${traceId || '—'}`)
      console.log(`summary (stored): ${String(row.summary).slice(0, 120)}…`)
      if (turnText) {
        console.log(`turn input (${turnText.length}字): ${turnText.slice(0, 160)}…`)
      } else {
        console.log('turn input: （未匹配 turn_events，可能来自 entry/任务）')
      }
      console.log('诊断: episodeExtractor 返回了 summary 但 atoms[] 为空 → 已加 pipeline fallback atom')
      console.log('')
    }

    const withAtoms = await pool.query(
      `SELECT e.summary, a.content, a.source_type, a.is_high_value
       FROM evidence_episodes e
       JOIN fact_atoms a ON a.episode_id = e.episode_id
       WHERE e.family_id = $1 AND e.child_id = $2
       ORDER BY e.source_created_at DESC LIMIT 3`,
      [familyId, childId]
    )
    console.log('【对照：最近 3 条有 atom 的 episode】')
    for (const r of withAtoms.rows) {
      console.log(`  summary: ${String(r.summary).slice(0, 60)}…`)
      console.log(`  atom[0]: [${r.source_type} hv=${r.is_high_value}] ${String(r.content).slice(0, 72)}…`)
    }
    console.log('')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

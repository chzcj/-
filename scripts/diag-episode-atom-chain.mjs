#!/usr/bin/env node
/**
 * Episode Atom 全链路摸底 + 稳固性扫描
 * 运行：npx tsx scripts/diag-episode-atom-chain.mjs [familyId] [childId]
 */
import pg from 'pg'

const familyId = process.argv[2] || ''
const childId = process.argv[3] || ''

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('DATABASE_URL 未设置')
    process.exit(0)
  }
  const pool = new pg.Pool({ connectionString: url, max: 3 })

  try {
    console.log('\n=== Episode Atom 全链路摸底 ===\n')

    // 1. 全局产量
    const [globalEp, globalAtoms, globalHv, jobs, jobFail] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM evidence_episodes`),
      pool.query(`SELECT COUNT(*)::int AS n FROM fact_atoms`),
      pool.query(`SELECT COUNT(*)::int AS n FROM fact_atoms WHERE is_high_value=TRUE`),
      pool.query(`
        SELECT status, COUNT(*)::int AS n
        FROM job_queue WHERE job_type='episode_ingest'
        GROUP BY status ORDER BY n DESC`),
      pool.query(`
        SELECT COUNT(*)::int AS n FROM job_queue
        WHERE job_type='episode_ingest' AND status='failed'`),
    ])

    const epN = globalEp.rows[0]?.n ?? 0
    const atomN = globalAtoms.rows[0]?.n ?? 0
    const hvN = globalHv.rows[0]?.n ?? 0
    const hvRate = atomN ? ((hvN / atomN) * 100).toFixed(1) : '0'

    console.log('【1】全局存储')
    console.log(`  evidence_episodes: ${epN}`)
    console.log(`  fact_atoms 总计: ${atomN}（高价值 ${hvN}，占比 ${hvRate}%）`)
    console.log('  episode_ingest job 状态:', jobs.rows.map((r) => `${r.status}=${r.n}`).join(', ') || '无')
    console.log(`  episode_ingest 失败累计: ${jobFail.rows[0]?.n ?? 0}`)

    // 2. 高价值 source_type 分布
    const hvBySource = await pool.query(`
      SELECT source_type, fact_type, COUNT(*)::int AS n
      FROM fact_atoms WHERE is_high_value=TRUE
      GROUP BY source_type, fact_type
      ORDER BY n DESC LIMIT 12`)
    console.log('\n【2】高价值 Atom 来源分布（top）')
    for (const r of hvBySource.rows) {
      console.log(`  ${r.source_type}/${r.fact_type || '—'}: ${r.n}`)
    }

    // 3. 近 7 日写入频率
    const recent = await pool.query(`
      SELECT date_trunc('day', created_at)::date AS day,
             COUNT(*) FILTER (WHERE table_name='ep')::int AS episodes,
             COUNT(*) FILTER (WHERE table_name='atom')::int AS atoms,
             COUNT(*) FILTER (WHERE table_name='hv')::int AS high_value
      FROM (
        SELECT created_at, 'ep' AS table_name FROM evidence_episodes
        WHERE created_at > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT created_at, 'atom' FROM fact_atoms
        WHERE created_at > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT created_at, 'hv' FROM fact_atoms
        WHERE is_high_value=TRUE AND created_at > NOW() - INTERVAL '7 days'
      ) t
      GROUP BY 1 ORDER BY 1 DESC`)
    console.log('\n【3】近 7 日写入（全库）')
    if (!recent.rows.length) console.log('  （近 7 日无新 episode/atom）')
    for (const r of recent.rows) {
      console.log(`  ${String(r.day).slice(0, 10)}: ep=${r.episodes} atom=${r.atoms} hv=${r.high_value}`)
    }

    // 4. 每 episode 的 atom 数分布
    const atomsPerEp = await pool.query(`
      SELECT CASE
        WHEN cnt = 0 THEN '0'
        WHEN cnt = 1 THEN '1'
        WHEN cnt BETWEEN 2 AND 4 THEN '2-4'
        ELSE '5+'
      END AS bucket, COUNT(*)::int AS episodes
      FROM (
        SELECT e.episode_id, COUNT(a.atom_id)::int AS cnt
        FROM evidence_episodes e
        LEFT JOIN fact_atoms a ON a.episode_id = e.episode_id
        GROUP BY e.episode_id
      ) x
      GROUP BY 1 ORDER BY 1`)
    console.log('\n【4】每 Episode 的 Atom 数分布')
    for (const r of atomsPerEp.rows) {
      console.log(`  ${r.bucket} atoms: ${r.episodes} episodes`)
    }

    // 5. 高价值 embedding 覆盖率
    const embedCov = await pool.query(`
      SELECT
        COUNT(*)::int AS hv_total,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS hv_embedded
      FROM fact_atoms WHERE is_high_value=TRUE`)
    const hvT = embedCov.rows[0]?.hv_total ?? 0
    const hvE = embedCov.rows[0]?.hv_embedded ?? 0
    console.log('\n【5】高价值 Atom 向量覆盖')
    console.log(`  ${hvE}/${hvT} 已向量化（${hvT ? ((hvE / hvT) * 100).toFixed(1) : 0}%）`)

    // 6. 手账 episode_atom 准入
    const hbPages = await pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE data->>'source'='episode_atom')::int AS from_atom
      FROM memory_layer_items
      WHERE layer_name='family_handbook_pages'`)

    // 7. Top tenants
    const topTenants = await pool.query(`
      SELECT e.family_id, e.child_id,
             COUNT(DISTINCT e.episode_id)::int AS episodes,
             COUNT(a.atom_id)::int AS atoms,
             COUNT(a.atom_id) FILTER (WHERE a.is_high_value)::int AS hv_atoms
      FROM evidence_episodes e
      LEFT JOIN fact_atoms a ON a.episode_id = e.episode_id
      GROUP BY e.family_id, e.child_id
      ORDER BY episodes DESC LIMIT 8`)
    console.log('\n【6】手账准入')
    console.log(`  family_handbook_pages 总计: ${hbPages.rows[0]?.total ?? 0}（episode_atom 源: ${hbPages.rows[0]?.from_atom ?? 0}）`)
    console.log('\n【7】Top 租户 Episode/Atom 产量')
    for (const r of topTenants.rows) {
      const hvPct = r.atoms ? ((r.hv_atoms / r.atoms) * 100).toFixed(0) : '0'
      console.log(`  ${r.family_id}/${r.child_id}: ep=${r.episodes} atom=${r.atoms} hv=${r.hv_atoms} (${hvPct}%)`)
    }

    if (familyId && childId) {
      console.log(`\n=== 租户明细：${familyId}/${childId} ===\n`)
      const [turns, eps, atoms, hv, turn7, ep7, jobsT] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS n FROM memory_layer_items
           WHERE layer_name='turn_events' AND family_id=$1 AND child_id=$2`,
          [familyId, childId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM evidence_episodes WHERE family_id=$1 AND child_id=$2`,
          [familyId, childId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM fact_atoms WHERE family_id=$1 AND child_id=$2`,
          [familyId, childId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM fact_atoms
           WHERE family_id=$1 AND child_id=$2 AND is_high_value=TRUE`,
          [familyId, childId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM memory_layer_items
           WHERE layer_name='turn_events' AND family_id=$1 AND child_id=$2
           AND created_at > NOW() - INTERVAL '7 days'`,
          [familyId, childId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM evidence_episodes
           WHERE family_id=$1 AND child_id=$2
           AND created_at > NOW() - INTERVAL '7 days'`,
          [familyId, childId]
        ),
        pool.query(
          `SELECT status, COUNT(*)::int AS n FROM job_queue
           WHERE job_type='episode_ingest'
           AND payload::text LIKE $1
           GROUP BY status`,
          [`%${familyId}%`]
        ),
      ])

      const turnN = turns.rows[0]?.n ?? 0
      const epTN = eps.rows[0]?.n ?? 0
      console.log(`  turn_events 累计: ${turnN}（近7天 ${turn7.rows[0]?.n ?? 0}）`)
      console.log(`  episodes 累计: ${epTN}（近7天 ${ep7.rows[0]?.n ?? 0}）`)
      console.log(`  atoms: ${atoms.rows[0]?.n ?? 0}，高价值: ${hv.rows[0]?.n ?? 0}`)
      console.log(
        `  有效轮→episode 转化率（粗估）: ${turnN ? ((epTN / turnN) * 100).toFixed(0) : 0}%（非 1:1，含 onboarding/任务/entry）`
      )
      console.log('  episode_ingest jobs:', jobsT.rows.map((r) => `${r.status}=${r.n}`).join(', ') || '无')

      const hvSample = await pool.query(
        `SELECT a.content, a.source_type, a.fact_type, a.created_at
         FROM fact_atoms a
         WHERE a.family_id=$1 AND a.child_id=$2 AND a.is_high_value=TRUE
         ORDER BY a.created_at DESC LIMIT 5`,
        [familyId, childId]
      )
      console.log('\n  最近 5 条高价值 Atom 样例:')
      for (const r of hvSample.rows) {
        const preview = String(r.content).slice(0, 48).replace(/\n/g, ' ')
        console.log(`    [${r.source_type}/${r.fact_type || '—'}] ${preview}…`)
      }

      const hbAtom = await pool.query(
        `SELECT COUNT(*)::int AS n FROM memory_layer_items
         WHERE layer_name='family_handbook_pages' AND family_id=$1 AND child_id=$2
         AND data->>'source'='episode_atom'`,
        [familyId, childId]
      )
      console.log(`\n  手账 episode_atom 页: ${hbAtom.rows[0]?.n ?? 0}`)
    }

    // 8. 稳固性：失败 job 样例
    const failSample = await pool.query(`
      SELECT id, attempts, last_error, updated_at
      FROM job_queue
      WHERE job_type='episode_ingest' AND status='failed'
      ORDER BY updated_at DESC LIMIT 3`)
    console.log('\n【8】稳固性：最近 episode_ingest 失败（若有）')
    if (!failSample.rows.length) {
      console.log('  ✓ 无 failed episode_ingest')
    } else {
      for (const r of failSample.rows) {
        const err = String(r.last_error || '').slice(0, 120)
        console.log(`  id=${r.id} attempts=${r.attempts} ${err}`)
      }
    }

    // 9. EPISODE_VECTOR 类错误
    const vecFail = await pool.query(`
      SELECT COUNT(*)::int AS n FROM job_queue
      WHERE job_type='episode_ingest' AND status='failed'
      AND last_error ILIKE '%EPISODE_VECTOR%'`)
    if ((vecFail.rows[0]?.n ?? 0) > 0) {
      console.log(`  ⚠ EPISODE_VECTOR_UNAVAILABLE 类失败: ${vecFail.rows[0].n}`)
    }

    console.log('\n【链路摘要】')
    console.log('  写入触发: daily有效轮 | onboarding entry summary | 保存今晚任务 | deep-expand')
    console.log('  高价值门槛: child_quote | material_observation | counter_evidence | feedback | isHighValue=true')
    console.log('  手账: 仅 is_high_value atom → episode_atom 候选（非每条 turn）')
    console.log('')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

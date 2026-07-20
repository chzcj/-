#!/usr/bin/env node
/**
 * 预演痛点频次摸底（只读）
 * 用法：npx tsx scripts/diag-rehearsal-pain-points.mjs [familyId] [childId]
 * 需 DATABASE_URL（本地或隧道）
 */
import pg from 'pg'

const familyId = process.argv[2] || 'fam_1783439265597_luqfco'
const childId = process.argv[3] || 'child_1783439265597_omvbu6'

const CLUSTERS = [
  { id: 'homework_start', label: '作业启动', re: /作业|写作业|催.*写|不写|拖着|磨蹭|启动/ },
  { id: 'after_conflict', label: '吵完修复', re: /吵|顶嘴|说重了|冷战|不理|关门|回房/ },
  { id: 'phone', label: '手机规则', re: /手机|平板|游戏|刷视频|收走/ },
  { id: 'morning', label: '早上出门', re: /起床|出门|迟到|早上|早饭/ },
  { id: 'grades', label: '成绩沟通', re: /成绩|分数|考试|卷子|排名/ },
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('DATABASE_URL 未设置，跳过 DB 摸底（契约文档仍有效）')
    process.exit(0)
  }
  const pool = new pg.Pool({ connectionString: url, max: 2 })
  try {
    const turns = await pool.query(
      `SELECT data->>'userMessage' AS msg, data->>'createdAt' AS at, data->>'mode' AS mode
       FROM memory_layer_items
       WHERE layer_name='turn_events' AND family_id=$1 AND child_id=$2
       ORDER BY (data->>'createdAt') DESC NULLS LAST
       LIMIT 400`,
      [familyId, childId]
    )

    const counts = Object.fromEntries(CLUSTERS.map((c) => [c.id, { label: c.label, n90: 0, n14: 0, samples: [] }]))
    const now = Date.now()
    const d14 = 14 * 864e5
    const d90 = 90 * 864e5

    for (const row of turns.rows) {
      const msg = (row.msg || '').trim()
      if (msg.length < 4) continue
      const at = row.at ? new Date(row.at).getTime() : 0
      const age = at ? now - at : d90
      for (const c of CLUSTERS) {
        if (!c.re.test(msg)) continue
        const bucket = counts[c.id]
        if (age <= d90) bucket.n90++
        if (age <= d14) bucket.n14++
        if (bucket.samples.length < 2) bucket.samples.push(msg.slice(0, 80))
      }
    }

    console.log(`\n=== 预演痛点频次：${familyId}/${childId}（近400 turn）===\n`)
    console.log('| cluster | 近90天 | 近14天 | 样例 |')
    console.log('|---------|--------|--------|------|')
    const ranked = Object.entries(counts).sort((a, b) => b[1].n14 * 2 + b[1].n90 - (a[1].n14 * 2 + a[1].n90))
    for (const [id, v] of ranked) {
      console.log(`| ${id} (${v.label}) | ${v.n90} | ${v.n14} | ${(v.samples[0] || '—').replace(/\|/g, '/')} |`)
    }
    console.log('\n建议 Top5：按 n14*2+n90 排序，不足用 trajectory/entryFacts 补（见 rehearsal-field-inventory.md）')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

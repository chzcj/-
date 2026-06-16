// pgvector 三层检索端到端验证 — 证明「语义召回完整 Episode 场景包」
// 用法：DATABASE_URL=... EMBEDDING_API_KEY=... node scripts/verify-pgvector.mjs ["自定义query"]
// key/DB 仅从环境变量读取，不写入文件。
import pg from 'pg'

const KEY = process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY || ''
const DB = process.env.DATABASE_URL || ''
const BASE = (process.env.EMBEDDING_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
const MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-v3'

if (!KEY || !DB) { console.error('需要 EMBEDDING_API_KEY 和 DATABASE_URL'); process.exit(1) }

async function embed(text) {
  const res = await fetch(`${BASE}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, input: text }),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return (await res.json()).data[0].embedding
}

const run = async () => {
  const query = process.argv[2] || '孩子一遇到不会的就逃避，不肯面对困难'
  const vec = await embed(query)
  const lit = `[${vec.join(',')}]`
  const pool = new pg.Pool({ connectionString: DB })

  console.log(`查询: ${query}`)
  console.log('（"逃避/困难" 等词不在任何 Episode 原文中，纯靠语义召回）\n')

  const ep = await pool.query(
    `SELECT left(summary,44) AS summary, scene_tags,
            round((embedding <=> $1::vector)::numeric,4) AS distance
     FROM evidence_episodes WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector LIMIT 5`,
    [lit]
  )
  console.log('【召回的 Episode 场景包】（完整场景，非碎片）：')
  ep.rows.forEach((r, i) => console.log(`  ${i + 1}. dist=${r.distance}  ${r.summary}  ${JSON.stringify(r.scene_tags)}`))

  const hv = await pool.query(
    `SELECT source_type, left(content,28) AS content,
            round((embedding <=> $1::vector)::numeric,4) AS distance
     FROM fact_atoms WHERE is_high_value AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector LIMIT 3`,
    [lit]
  )
  console.log('\n【召回的高价值 Atom】（孩子原话/反证等）：')
  hv.rows.forEach((r, i) => console.log(`  ${i + 1}. dist=${r.distance}  [${r.source_type}] ${r.content}`))

  await pool.end()
}
run().catch(e => { console.error('失败：', e.message); process.exit(1) })

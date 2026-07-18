#!/usr/bin/env node
/**
 * 演示：家长输入 → embedding → pgvector 检索 → 精排 → 注入 prompt 上下文
 * 用法：node scripts/demo-vector-retrieval.mjs [家长输入文本]
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envText = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const get = (k) => (envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] || '').replace(/^"|"$/g, '')

const EMB_KEY = get('EMBEDDING_API_KEY')
const EMB_BASE = get('EMBEDDING_BASE_URL').replace(/\/$/, '')
const EMB_MODEL = get('EMBEDDING_MODEL')
const DB_URL = get('DATABASE_URL')
const parentQuery = process.argv[2] || '他又开始逃避写作业，把本子摔桌上了'

const TAU = Number(process.env.RETRIEVAL_TIME_TAU || 30)
const COARSE_K = Number(process.env.RETRIEVAL_COARSE_K || 20)

function toVectorLiteral(v) {
  return `[${v.join(',')}]`
}

function timeDecay(iso) {
  if (!iso) return 0.5
  const ageDays = Math.max(0, (Date.now() - new Date(iso).getTime()) / 86_400_000)
  return Math.exp(-ageDays / TAU)
}

async function embedText(text) {
  const res = await fetch(`${EMB_BASE}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${EMB_KEY}` },
    body: JSON.stringify({ model: EMB_MODEL, input: [text] }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(`embedding ${res.status}: ${JSON.stringify(j?.error || j)}`)
  return j.data[0].embedding
}

async function main() {
  const pool = new pg.Pool({ connectionString: DB_URL })
  const top = await pool.query(
    'SELECT family_id, child_id, count(*)::int AS c FROM evidence_episodes GROUP BY 1,2 ORDER BY c DESC LIMIT 1'
  )
  const { family_id: familyId, child_id: childId, c: episodeCount } = top.rows[0] || {}
  if (!familyId) {
    console.log('无 Episode 数据，无法演示')
    await pool.end()
    return
  }

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  育见 · 记忆向量检索演示（真实 DB + 真实百炼 embedding）')
  console.log('══════════════════════════════════════════════════════════\n')

  console.log('【0】演示家庭')
  console.log(`  familyId=${familyId}  childId=${childId}  历史 Episode=${episodeCount} 条\n`)

  console.log('【1】家长本轮输入（query）')
  console.log(`  「${parentQuery}」\n`)

  console.log('【2】embedText() → 百炼 text-embedding-v3')
  const t0 = Date.now()
  const queryVector = await embedText(parentQuery)
  console.log(`  ✓ 得到 ${queryVector.length} 维向量（前 5 维: ${queryVector.slice(0, 5).map((x) => x.toFixed(4)).join(', ')}…）`)
  console.log(`  ✓ 耗时 ${Date.now() - t0}ms\n`)

  console.log('【3】pgvector cosine 检索 evidence_episodes（粗召回 topK=20）')
  const hits = await pool.query(
    `SELECT episode_id, summary, parent_interpretation, scene_tags, mechanism_tags,
            source_created_at, embedding <=> $1::vector AS distance
     FROM evidence_episodes
     WHERE family_id = $2 AND child_id = $3 AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $4`,
    [toVectorLiteral(queryVector), familyId, childId, COARSE_K]
  )
  console.log(`  ✓ 粗召回 ${hits.rows.length} 条\n`)

  console.log('【4】精排：score = 0.7×(1-distance) + 0.3×时间衰减，取 top 5')
  const ranked = hits.rows
    .map((h) => ({
      ...h,
      sim: 1 - Number(h.distance),
      decay: timeDecay(h.source_created_at),
      score: 0.7 * (1 - Number(h.distance)) + 0.3 * timeDecay(h.source_created_at),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  ranked.forEach((r, i) => {
    console.log(`  ${i + 1}. score=${r.score.toFixed(3)}  sim=${r.sim.toFixed(3)}  decay=${r.decay.toFixed(3)}  dist=${Number(r.distance).toFixed(4)}`)
    console.log(`     摘要: ${r.summary}`)
    if (r.parent_interpretation) console.log(`     家长理解: ${r.parent_interpretation}`)
    console.log(`     标签: scene=${JSON.stringify(r.scene_tags)} mech=${JSON.stringify(r.mechanism_tags)}`)
    console.log('')
  })

  const episodeIds = ranked.map((r) => r.episode_id)
  const atoms = episodeIds.length
    ? await pool.query(
        `SELECT episode_id, content, source_type, is_high_value FROM fact_atoms
         WHERE family_id=$1 AND child_id=$2 AND episode_id = ANY($3::text[])`,
        [familyId, childId, episodeIds]
      )
    : { rows: [] }

  console.log('【5】依附 Atom（Episode 内全部事实）+ 高价值 Atom 跨 Episode 召回')
  for (const ep of ranked.slice(0, 3)) {
    const epAtoms = atoms.rows.filter((a) => a.episode_id === ep.episode_id)
    console.log(`  Episode「${ep.summary.slice(0, 40)}…」→ ${epAtoms.length} 个 atom`)
    epAtoms.slice(0, 4).forEach((a) => {
      console.log(`    · [${a.source_type}${a.is_high_value ? '/高价值' : ''}] ${a.content}`)
    })
  }

  const hvHits = await pool.query(
    `SELECT content, source_type, embedding <=> $1::vector AS distance
     FROM fact_atoms
     WHERE family_id=$2 AND child_id=$3 AND is_high_value=TRUE AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector LIMIT 5`,
    [toVectorLiteral(queryVector), familyId, childId]
  )
  console.log('\n  跨 Episode 高价值 Atom top5:')
  hvHits.rows.forEach((a, i) => {
    console.log(`    ${i + 1}. dist=${Number(a.distance).toFixed(4)} [${a.source_type}] ${a.content}`)
  })

  const recentFallback = await pool.query(
    `SELECT left(data->>'newInput', 80) AS text FROM memory_layer_items
     WHERE family_id=$1 AND child_id=$2 AND layer_name='daily_updates'
     ORDER BY updated_at DESC LIMIT 5`,
    [familyId, childId]
  )

  console.log('\n【6】对比：若不用向量，「只取最近 5 条」会是：')
  recentFallback.rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.text}`))

  const episodeTexts = ranked.map((r) => r.summary)
  const hvTexts = [
    ...atoms.rows.filter((a) => a.is_high_value).map((a) => a.content),
    ...hvHits.rows.map((a) => a.content),
  ]
  const supportingEvidence = [...episodeTexts.slice(0, 3), ...hvTexts.slice(0, 2)].slice(0, 5)

  console.log('\n【7】最终注入 Agent prompt 的 supportingEvidence（router.ts 逻辑）')
  supportingEvidence.forEach((t, i) => console.log(`  ${i + 1}. ${t}`))

  console.log('\n【8】写入侧（异步 job episode_ingest）— 同一输入稍后也会：')
  console.log('  家长原文 → episodeExtractor(LLM) → Episode.summary + Atoms')
  console.log('  → embedText(summary) + embedTexts(高价值Atom) → upsert pgvector')
  console.log('  → 供下轮检索使用\n')

  console.log('══════════════════════════════════════════════════════════\n')
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

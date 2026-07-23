#!/usr/bin/env node
/**
 * 交流 Section 重复度审计：从 turn_events.specializedContextPackSnapshot.sections 抽样统计。
 *
 * 用法:
 *   export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
 *   node scripts/audit-section-repetition.mjs
 *
 * 输出 JSON 到 stdout；可加 --out .trae/reports/section-repetition.json
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const LIMIT = Number(process.env.SECTION_AUDIT_LIMIT || 600)
const outArg = process.argv.indexOf('--out')
const outFile = outArg >= 0 ? process.argv[outArg + 1] : null

function norm(s) {
  return (s || '').replace(/\s+/g, '').replace(/[，。！？、；：""''（）]/g, '').toLowerCase()
}

function bodyOf(sec) {
  return [...(sec.paragraphs || []), ...(sec.items || []), ...(sec.quotes || [])].join(' ').trim()
}

function firstSentence(s) {
  const m = (s || '').match(/^[^。！？]{4,100}[。！？]?/)
  return m ? m[0] : (s || '').slice(0, 48)
}

function jaccard(a, b) {
  const sa = new Set(a.match(/[\u4e00-\u9fff]{2,}/g) || [])
  const sb = new Set(b.match(/[\u4e00-\u9fff]{2,}/g) || [])
  if (!sa.size || !sb.size) return 0
  let inter = 0
  for (const x of sa) if (sb.has(x)) inter++
  return inter / (sa.size + sb.size - inter)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 })

const totalRes = await pool.query(
  `SELECT count(*)::int AS c FROM memory_layer_items WHERE layer_name = $1`,
  ['turn_events'],
)
const withSecRes = await pool.query(
  `SELECT count(*)::int AS c FROM memory_layer_items
   WHERE layer_name = $1
     AND (data->'specializedContextPackSnapshot'->'sections') IS NOT NULL
     AND jsonb_array_length(data->'specializedContextPackSnapshot'->'sections') > 0`,
  ['turn_events'],
)

const rows = await pool.query(
  `SELECT
     data->'specializedContextPackSnapshot'->'sections' AS sections,
     data->>'inputType' AS input_type,
     data->'relationship'->>'type' AS rel_type,
     updated_at
   FROM memory_layer_items
   WHERE layer_name = $1
     AND (data->'specializedContextPackSnapshot'->'sections') IS NOT NULL
     AND jsonb_array_length(data->'specializedContextPackSnapshot'->'sections') > 0
   ORDER BY updated_at DESC
   LIMIT $2`,
  ['turn_events', LIMIT],
)

const byId = {}
const openings = {}
const prefixDup = {}
const skeletonCounts = {}
const crossDup = {}
const phraseFreq = {}

const PHRASE_PATTERNS = [
  '你家孩子属于',
  '下笔前先害怕',
  '一催就',
  '今晚只改',
  '今晚先这样试',
  '催促→',
  '不是懒',
  '不是磨蹭',
  '还在了解',
  '一种可能是',
  '更可能不是',
  '先别急着',
  '属于「',
  '这一类的',
  '反复出现',
  '值得留意',
]

for (const row of rows.rows) {
  const secs = row.sections || []
  const sk = secs
    .map((s) => `${s.id}${s.hidden ? '*' : ''}`)
    .sort()
    .join(',')
  skeletonCounts[sk] = (skeletonCounts[sk] || 0) + 1

  const bodies = {}
  for (const sec of secs) {
    const id = sec.id
    const body = bodyOf(sec)
    if (!body) continue
    bodies[id] = body
    if (!byId[id]) byId[id] = { count: 0, lengths: [], samples: [] }
    byId[id].count++
    byId[id].lengths.push(body.length)
    if (byId[id].samples.length < 3) byId[id].samples.push(body.slice(0, 160))

    const open = firstSentence(body)
    const ok = `${id}::${open}`
    openings[ok] = (openings[ok] || 0) + 1

    const pk = `${id}::${norm(body).slice(0, 100)}`
    prefixDup[pk] = (prefixDup[pk] || 0) + 1

    for (const p of PHRASE_PATTERNS) {
      if (body.includes(p)) phraseFreq[`${id}::${p}`] = (phraseFreq[`${id}::${p}`] || 0) + 1
    }
  }

  const ids = Object.keys(bodies)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = bodies[ids[i]]
      const b = bodies[ids[j]]
      const sim = jaccard(a, b)
      if (sim >= 0.35) {
        const pk = `${ids[i]}<->${ids[j]}`
        crossDup[pk] = crossDup[pk] || { count: 0, maxSim: 0, example: '' }
        crossDup[pk].count++
        if (sim > crossDup[pk].maxSim) {
          crossDup[pk].maxSim = sim
          crossDup[pk].example = `${a.slice(0, 60)} …||… ${b.slice(0, 60)}`
        }
      }
    }
  }
}

const idStats = Object.entries(byId)
  .map(([id, v]) => ({
    id,
    count: v.count,
    avgLen: Math.round(v.lengths.reduce((s, x) => s + x, 0) / v.lengths.length),
    samples: v.samples,
  }))
  .sort((a, b) => b.count - a.count)

const topOpenings = Object.entries(openings)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .map(([k, c]) => {
    const [id, ...rest] = k.split('::')
    return { id, opening: rest.join('::'), count: c, rate: +(c / (byId[id]?.count || 1)).toFixed(3) }
  })

const topPrefixDup = Object.entries(prefixDup)
  .filter(([, c]) => c >= 3)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .map(([k, c]) => {
    const [id, prefix] = k.split('::')
    return { id, prefixPreview: prefix.slice(0, 80), count: c }
  })

const topPhrases = Object.entries(phraseFreq)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .map(([k, c]) => {
    const [id, phrase] = k.split('::')
    return { id, phrase, count: c, rate: +(c / (byId[id]?.count || 1)).toFixed(3) }
  })

const topCross = Object.entries(crossDup)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 15)
  .map(([pair, v]) => ({ pair, ...v, maxSim: +v.maxSim.toFixed(3) }))

const topSkeletons = Object.entries(skeletonCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([sk, c]) => ({ skeleton: sk, count: c, rate: +(c / rows.rows.length).toFixed(3) }))

const report = {
  generatedAt: new Date().toISOString(),
  totalTurnEvents: totalRes.rows[0].c,
  turnsWithSections: withSecRes.rows[0].c,
  sampled: rows.rows.length,
  sectionIdStats: idStats,
  topSkeletonCombos: topSkeletons,
  highRepeatOpenings: topOpenings.filter((x) => x.count >= 3 && x.rate >= 0.08),
  duplicateBodyPrefixes: topPrefixDup,
  templatePhrases: topPhrases.filter((x) => x.rate >= 0.15),
  crossSectionOverlap: topCross,
  mergeCandidates: [
    {
      pair: 'diagnosis_headline ↔ history_thinking',
      reason: 'SP 均要求引用 pack 事实；history 常复述 diagnosis 里的场景链',
      evidence: topCross.find((x) => x.pair === 'diagnosis_headline<->history_thinking'),
    },
    {
      pair: 'advice ↔ prose 正文',
      reason: 'advice 与 prose 同属「今晚怎么做」；taskTitle 又从 advice 提炼',
      evidence: topPhrases.filter((x) => x.id === 'advice' && /今晚/.test(x.phrase)),
    },
    {
      pair: 'profile_reading ↔ diagnosis_headline',
      reason: 'hidden 画像段与深度分析都写「在…场景里更容易…」',
      evidence: topCross.find((x) => x.pair === 'diagnosis_headline<->profile_reading'),
    },
  ],
}

if (outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8')
  console.error(`wrote ${outFile}`)
}

console.log(JSON.stringify(report, null, 2))
await pool.end()

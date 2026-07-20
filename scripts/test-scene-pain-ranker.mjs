/**
 * scene-pain-ranker 纯函数测试（无 DB）
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// tsx 可直接 import ts；用动态避免 build 顺序问题
const {
  rankPainClusters,
} = await import('../src/lib/server/rehearsal/scene-pain-ranker.ts')

const now = Date.parse('2026-07-20T00:00:00.000Z')
const d2 = new Date(now - 2 * 864e5).toISOString()
const d30 = new Date(now - 30 * 864e5).toISOString()

const turns = [
  { text: '感觉跟孩子最近老吵架，因为写作业的事儿', createdAt: d2 },
  { text: '又催作业，他拖着不写', createdAt: d2 },
  { text: '手机一看就停不下来', createdAt: d2 },
  { text: '【预演场景：手机规则怎么谈】场景摘要：……', createdAt: d2 },
  { text: '上次考试分数出来气氛很僵', createdAt: d30 },
]

const ranked = rankPainClusters(turns, { now, topN: 5 })

assert.equal(ranked[0].id, 'homework_start')
assert.ok(ranked[0].n14 >= 2)
assert.match(ranked[0].mentionCountHint, /近2周/)
assert.ok(ranked.some((r) => r.id === 'phone' && r.n14 >= 1))
assert.ok(ranked.every((r) => !r.samples.some((s) => s.startsWith('【预演场景'))))
// pad to 5
assert.equal(ranked.length, 5)
// zero-score pads have empty hint
const morning = ranked.find((r) => r.id === 'morning')
assert.ok(morning)
assert.equal(morning.mentionCountHint, '')

console.log('=== scene-pain-ranker ===')
console.log(ranked.map((r) => `${r.id}:${r.score}:${r.mentionCountHint || '—'}`).join(' | '))
console.log('✓ pass')

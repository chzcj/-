// 手账准入矩阵单测（纯逻辑，无 DB）
// 运行：npx tsx scripts/test-handbook-admission.mjs

import { handbookPageToFeedItem, handbookPageId } from '../src/lib/profile/handbook-feed-map.ts'

let pass = 0
let fail = 0
const assert = (c, m) => {
  c ? pass++ : (fail++, console.error('  ✗', m))
}

console.log('=== 手账准入契约测试 ===\n')

console.log('1. handbookPageId 幂等')
const id1 = handbookPageId('task_shine', 'task-abc')
assert(id1 === 'task_shine:task-abc', 'stable page id')

console.log('\n2. handbookPageToFeedItem displayLine 优先')
const item = handbookPageToFeedItem({
  pageId: id1,
  source: 'task_shine',
  sourceRef: 'task-abc',
  occurredAt: '2026-07-16T10:00:00Z',
  displayLine: '自己拿出作业本开工',
  weekKey: '2026-W29',
  polished: true,
})
assert(item.displayLine === '自己拿出作业本开工', 'displayLine 保留')
assert(item.snippet === '', 'teaser 与 displayLine 相同时 snippet 为空')
assert(item.type === 'shine', 'task_shine → shine')
assert(item.id === `page:${id1}`, 'id 前缀 page:')

console.log('\n3. rehearsal_voice → voice')
const voice = handbookPageToFeedItem({
  pageId: handbookPageId('rehearsal_voice', 'tr-1'),
  source: 'rehearsal_voice',
  sourceRef: 'tr-1',
  occurredAt: '2026-07-16T10:00:00Z',
  displayLine: '催作业时声调又抬高',
  weekKey: '2026-W29',
})
assert(voice.type === 'voice', 'rehearsal → voice')
assert(voice.durationLabel === '录音', 'voice 有录音标签')

console.log('\n4. episode_atom → diary')
const atom = handbookPageToFeedItem({
  pageId: handbookPageId('episode_atom', 'at-1'),
  source: 'episode_atom',
  sourceRef: 'at-1',
  occurredAt: '2026-07-16T10:00:00Z',
  displayLine: '被催时更想躲开作业',
  weekKey: '2026-W29',
})
assert(atom.type === 'diary', 'episode_atom → diary')

console.log('\n5. 准入源枚举覆盖')
const sources = [
  'rehearsal_voice',
  'how_to_speak',
  'task_shine',
  'highlight_moment',
  'trajectory_hard',
  'episode_atom',
]
for (const s of sources) {
  const feed = handbookPageToFeedItem({
    pageId: handbookPageId(s, 'ref'),
    source: s,
    sourceRef: 'ref',
    occurredAt: '2026-07-16T10:00:00Z',
    displayLine: '测试行',
    weekKey: '2026-W29',
  })
  assert(Boolean(feed.type), `${s} 可映射 feed type`)
}

console.log(`\n=== 结果: ${pass} pass, ${fail} fail ===`)
process.exit(fail ? 1 : 0)

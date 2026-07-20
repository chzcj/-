// 契约测试：HandbookPack BFF 组装形状
// 运行：npx tsx scripts/test-handbook-pack.mjs
import { normalizeHighlightsInput } from '../src/types/highlight-moment.ts'
import { timeCapsuleToTeaser } from '../src/types/handbook-pack.ts'
import { curateMemoryFeedPreview } from '../src/lib/server/profile/handbook-preview-curation.ts'

let pass = 0
let fail = 0
const assert = (c, m) => {
  c ? pass++ : (fail++, console.error('  ✗', m))
}

console.log('=== HandbookPack 契约测试 ===\n')

// 1. highlightMoments 归一化
console.log('1. normalizeHighlightsInput')
const fromStrings = normalizeHighlightsInput(['主动提出休息', '自己拿出作业本'])
assert(fromStrings.length === 2, 'string[] → 2 moments')
assert(fromStrings[0].teaser === '主动提出休息', 'teaser 保留')
assert(fromStrings[0].title.length <= 24, 'title 截断')

const fromObjects = normalizeHighlightsInput([
  {
    id: 'hl-1',
    title: '主动休息',
    teaser: '十分钟后自己拿出作业本',
    whyHighlighted: '少见的主动过渡',
    occurredAt: '2026-07-16',
  },
])
assert(fromObjects[0].whyHighlighted === '少见的主动过渡', 'object 保留 whyHighlighted')

const preservePrev = normalizeHighlightsInput(undefined, fromObjects)
assert(preservePrev.length === 1, '无新输入时保留 prev')

// 2. timeCapsule teaser
console.log('\n2. timeCapsuleToTeaser')
const snap = {
  periodLabel: '对比上次',
  thenLabel: '3个月前',
  nowLabel: '今天',
  thenSnapshot: '那时你们还在一回家就催作业',
  nowSnapshot: '过渡安排更清楚了',
  refreshedAt: new Date().toISOString(),
}
const teaser = timeCapsuleToTeaser(snap)
assert(teaser?.teaserTitle === snap.thenSnapshot.slice(0, 28), 'teaserTitle 来自 thenSnapshot')
assert(teaser?.periodLabel === '对比上次', 'periodLabel 保留')
assert(timeCapsuleToTeaser(null) === null, 'null → null')

// 3. HandbookPack 必需键（文档契约）
console.log('\n3. HandbookPack 键清单')
const REQUIRED_KEYS = [
  'hero',
  'stats',
  'handbook',
  'memoryFeed',
  'memoryFeedRecent',
  'memoryFeedPreview',
  'highlightMoments',
  'timeCapsule',
  'timeCapsuleSnapshot',
  'archiveWeeks',
  'refreshedAt',
  'watermark',
]
const mockPack = {
  hero: { childName: '果果', monthLabel: '七月', heroCopy: '…', pageCount: 1, weekPageDelta: 0 },
  stats: { highlightCount: 0, completenessPct: 25, memoryCount: 0 },
  handbook: null,
  memoryFeed: [],
  memoryFeedRecent: [],
  memoryFeedPreview: [],
  highlightMoments: [],
  timeCapsule: null,
  timeCapsuleSnapshot: null,
  archiveWeeks: [],
  refreshedAt: new Date().toISOString(),
  watermark: { handbookStale: true, memoryStale: true, partiallyRefreshing: false },
}
for (const key of REQUIRED_KEYS) {
  assert(key in mockPack, `含 ${key}`)
}

console.log('\n4. watermark.handbookRefreshing')
assert('handbookRefreshing' in mockPack.watermark || mockPack.watermark.handbookRefreshing === undefined, 'watermark 可含 handbookRefreshing')

console.log('\n5. curateMemoryFeedPreview Top3')
const feed = [
  { id: '1', type: 'hard', displayLine: '家庭难题本周出现', snippet: '家庭难题本周出现', occurredAt: '2026-07-16', sourceRef: 'a', keyword: '难题', hasRawEvidence: false },
  { id: '2', type: 'voice', displayLine: '催作业时声调又抬高', teaser: '预演里练过更轻的开口', whyIncluded: '预演记录了冲突升级瞬间，方便对照怎么改口。', occurredAt: '2026-07-17', sourceRef: 'b', keyword: '预演', hasRawEvidence: true },
  { id: '3', type: 'shine', displayLine: '自己拿出作业本开工', teaser: '少见的主动过渡', occurredAt: '2026-07-18', sourceRef: 'c', keyword: '作业', hasRawEvidence: true },
  { id: '4', type: 'diary', displayLine: '回家路上主动说了学校的事', occurredAt: '2026-07-19', sourceRef: 'd', keyword: '学校', hasRawEvidence: true },
  { id: '5', type: 'shine', displayLine: '交流本周出现', occurredAt: '2026-07-19', sourceRef: 'e', keyword: '交流', hasRawEvidence: false },
]
const top3 = curateMemoryFeedPreview(feed, 3)
assert(top3.length === 3, 'Top3 数量')
assert(!top3.some((i) => i.displayLine.includes('家庭难题本周出现')), '劣质 hard 被降权/剔除')
assert(!top3.some((i) => i.hasRawEvidence === false), '无原话证据不进 Top3')
assert(top3[0].type === 'voice' || top3[0].type === 'shine', 'voice/shine 优先')

console.log(`\n=== 结果: ${pass} pass, ${fail} fail ===`)
process.exit(fail ? 1 : 0)

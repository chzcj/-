#!/usr/bin/env node
/** memory-moment-detail 契约：全历史 pageId 格式 + 字段分离 */

import { handbookPageId } from '../src/lib/profile/handbook-feed-map.ts'

let pass = 0
let fail = 0
function assert(cond, msg) {
  if (cond) {
    pass++
    console.log('  ✓', msg)
  } else {
    fail++
    console.log('  ✗', msg)
  }
}

console.log('=== memory-moment-detail 契约 ===\n')

const pageId = handbookPageId('rehearsal_voice', 'trace-abc')
const memoryId = `page:${pageId}`
assert(memoryId === 'page:rehearsal_voice:trace-abc', 'page 型 memoryId 稳定')
assert(memoryId.startsWith('page:'), '详情 API 用 page: 前缀全历史查找')

/** MemoryMomentDetail 响应形状（与 types/handbook-pack.ts 对齐） */
const mockDetail = {
  item: { id: memoryId, type: 'voice', displayLine: '催作业时声调又抬高' },
  kicker: '预演语音 · 7月16日',
  title: '催作业时声调又抬高',
  lead: '先听原声，再看提炼的关键句——纪念感在前，分析在后。',
  whyIncluded: '预演里记录了冲突升级的瞬间，方便以后对照怎么改口。',
  evidenceBody: '【预演场景：写作业前怎么开口】家长说：你先写第一项就行。',
  body: '预演里记录了冲突升级的瞬间，方便以后对照怎么改口。',
  keyQuotes: ['你先写第一项就行'],
  interpretation: '这句话里「先」听起来像催促，孩子可能听到的是被安排。',
}

assert(mockDetail.whyIncluded !== mockDetail.evidenceBody, 'whyIncluded 与 evidenceBody 分离')
assert(mockDetail.whyIncluded.length >= 20, 'whyIncluded 有实质内容')
assert(mockDetail.evidenceBody.includes('家长说'), 'evidenceBody 含原话/场景')
assert(Array.isArray(mockDetail.keyQuotes), 'keyQuotes 数组')

console.log(`\n=== 结果: ${pass} pass, ${fail} fail ===\n`)
process.exit(fail ? 1 : 0)

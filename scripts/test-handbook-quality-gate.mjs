#!/usr/bin/env node
/** handbook-quality-gate 契约测试 */

import {
  shouldSkipHandbookAdmission,
  isBadHandbookPage,
  validatePolishedOutput,
} from '../src/lib/server/profile/handbook-quality-gate.ts'

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

console.log('=== handbook-quality-gate ===\n')

assert(shouldSkipHandbookAdmission('rehearsal_voice', '收到无意义输入'), 'reject 无意义')
assert(shouldSkipHandbookAdmission('rehearsal_voice', '谢谢'), 'reject 寒暄')
assert(!shouldSkipHandbookAdmission('rehearsal_voice', '手机规则谈判时语气突然变硬，孩子直接回房'), 'accept 预演语音')
assert(shouldSkipHandbookAdmission('trajectory_hard', '交流'), 'reject 泛化 trajectory title')
assert(!shouldSkipHandbookAdmission('trajectory_hard', '一回家就催作业，冲突多在进门十分钟内反复出现'), 'accept trajectory summary')
assert(isBadHandbookPage('任务反馈本周出现'), 'bad page 任务反馈本周出现')
assert(
  validatePolishedOutput('手机规则谈判时语气变硬', {
    displayLine: '谈手机规则时语气又变硬了',
    whyIncluded: '预演里记录了冲突升级的瞬间，方便以后对照怎么改口。',
  }),
  'validate polished ok'
)

console.log(`\n=== 结果: ${pass} pass, ${fail} fail ===\n`)
process.exit(fail ? 1 : 0)

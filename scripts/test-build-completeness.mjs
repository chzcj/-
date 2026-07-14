// 建档完成度 V2 契约
// 运行：npx tsx scripts/test-build-completeness.mjs
import {
  computeBuildCompleteness,
  computeBuildCompletenessV2,
  isBuildCompletenessV2Enabled,
  isInsufficientSummaryText,
  isOnboardingSummaryS3Enabled,
} from '../src/lib/build/completeness.ts'

let pass = 0
let fail = 0
const assert = (c, m) => {
  c ? pass++ : (fail++, console.error('  ✗', m))
}

console.log('=== build completeness V2 ===\n')

assert(isBuildCompletenessV2Enabled() === true, '默认 V2 开')
assert(isOnboardingSummaryS3Enabled() === true, '默认 Summary S3 开')
assert(isInsufficientSummaryText('信息不足，还需要更多现场', []) === true, '无 facts → 不足')
assert(isInsufficientSummaryText('当催作业时他会关房门', ['昨晚关了门']) === false, '有效摘要')

const fourConfirmedButTwoBad = computeBuildCompletenessV2([
  { confirmed: true, mainJudgment: '催作业时关房门', facts: ['关了门'] },
  { confirmed: true, mainJudgment: '信息不足，暂时无法还原', facts: [] },
  { confirmed: true, mainJudgment: '写作业拖到很晚', facts: ['拖到11点'] },
  { confirmed: true, mainJudgment: '材料太少，需要更多', facts: ['说了一句好'] },
])
assert(fourConfirmedButTwoBad.completeness === 50, `假100修复 → 50 (got ${fourConfirmedButTwoBad.completeness})`)
assert(fourConfirmedButTwoBad.insufficientCount === 2, '不足模块=2')
assert(fourConfirmedButTwoBad.qualityValidCount === 2, '有效=2')

const allGood = computeBuildCompletenessV2([
  { confirmed: true, mainJudgment: 'a', facts: ['f1'] },
  { confirmed: true, mainJudgment: 'b', facts: ['f2'] },
  { confirmed: true, mainJudgment: 'c', facts: ['f3'] },
  { confirmed: true, mainJudgment: 'd', facts: ['f4'] },
])
assert(allGood.completeness === 100, '四模块有效 → 100')

process.env.BUILD_COMPLETENESS_V2 = '0'
const legacy = computeBuildCompleteness([
  { confirmed: true, mainJudgment: '信息不足', facts: [] },
  { confirmed: true, mainJudgment: '信息不足', facts: [] },
  { confirmed: true, mainJudgment: '信息不足', facts: [] },
  { confirmed: true, mainJudgment: '信息不足', facts: [] },
])
assert(legacy.completeness === 100, 'legacy 回退仍 ×25')
delete process.env.BUILD_COMPLETENESS_V2

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`)
process.exit(fail === 0 ? 0 : 1)

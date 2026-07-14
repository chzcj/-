// S2 契约：正交 idem key + 开关
// 运行：npx tsx scripts/test-deep-mechanism-s2.mjs
import {
  deepMechanismBucketKey,
  deepMechanismDailyOpenKey,
  deepMechanismTurnMilestoneKey,
  isDeepMechanismS2Enabled,
} from '../src/lib/server/memory/deep-mechanism/s2-flags.ts'

let pass = 0
let fail = 0
const assert = (c, m) => {
  c ? pass++ : (fail++, console.error('  ✗', m))
}

const tenant = { familyId: 'f_test', childId: 'c_test' }
const day = new Date().toISOString().slice(0, 10)

console.log('=== deep_mechanism S2 契约 ===\n')

assert(isDeepMechanismS2Enabled() === true, '默认 S2 开启')

const bucket = deepMechanismBucketKey(tenant)
const open = deepMechanismDailyOpenKey(tenant)
const turn = deepMechanismTurnMilestoneKey(tenant, 10)

assert(bucket === `deep_mechanism:f_test:c_test:${day}`, `日桶 key (${bucket})`)
assert(open === `deep_mechanism:daily_open:f_test:c_test:${day}`, `daily_open key (${open})`)
assert(turn === 'deep_mechanism:turn:f_test:c_test:10', `turn key (${turn})`)
assert(bucket !== open, '日桶 ≠ daily_open（F4 不互跳过）')
assert(open !== turn, 'daily_open ≠ turn')
assert(bucket !== turn, '日桶 ≠ turn')

process.env.DEEP_MECHANISM_S2 = '0'
assert(isDeepMechanismS2Enabled() === false, 'S2=0 关闭')
delete process.env.DEEP_MECHANISM_S2

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`)
process.exit(fail === 0 ? 0 : 1)

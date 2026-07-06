// 契约测试：FrontendReadSchema / pickFrontendReadPack 门控
// 运行：npx tsx scripts/test-frontend-read-pack.mjs
import {
  FRONTEND_READ_PACK_KEYS,
  BACKEND_ONLY_CONTEXT_FIELDS,
  pickFrontendReadPack,
  isFrontendReadPackShape,
  assertNoBackendOnlyKeys,
} from '../src/lib/server/daily/frontend-read-pack.ts'
import { buildDailyProsePayload } from '../src/lib/server/daily/prose-context.ts'

let pass = 0
let fail = 0
const assert = (c, m) => {
  c ? pass++ : (fail++, console.error('  ✗', m))
}

console.log('=== FrontendReadSchema 契约测试 ===\n')

// 1. 键序稳定
console.log('1. FRONTEND_READ_PACK_KEYS 键序')
assert(FRONTEND_READ_PACK_KEYS[0] === 'childStructureModels', '首键 childStructureModels')
assert(FRONTEND_READ_PACK_KEYS.at(-1) === 'parentVerbatimSnippets', '末键 parentVerbatimSnippets')
assert(FRONTEND_READ_PACK_KEYS.length === 10, `共 10 个键 (got ${FRONTEND_READ_PACK_KEYS.length})`)

// 2. pickFrontendReadPack 形状
console.log('\n2. pickFrontendReadPack 形状')
const mockCtx = {
  relevantChildStructureModel: ['画像A'],
  relevantEntryEvidencePacks: ['证据包'],
  childQuotes: ['孩子说知道了'],
  parentVerbatimSnippets: ['昨晚我又催他写作业'],
  entryFacts: ['错题本只抄答案'],
  matchedMechanisms: ['亲职风格-高要求低回应'],
  relevantFamilyInteractionPatterns: ['催作业→发脾气'],
  parentNarrativePattern: ['担心成绩'],
  relevantPastEvents: ['昨晚吵了一架'],
  relevantPendingHypotheses: ['是否在逃避评价'],
  recentDiagnosis: ['禁止泄漏'],
}
const pack = pickFrontendReadPack(mockCtx)
assert(isFrontendReadPackShape(pack), 'pick 结果通过 isFrontendReadPackShape')
assert(pack.entryFacts[0] === '错题本只抄答案', 'entryFacts 映射正确')
assert(pack.childQuotes[0] === '孩子说知道了', 'childQuotes 映射正确')
assert(pack.parentVerbatimSnippets[0] === '昨晚我又催他写作业', 'parentVerbatimSnippets 映射正确')
assert(pack.familyPatterns[0] === '催作业→发脾气', 'familyPatterns 映射正确')
assert(!('recentDiagnosis' in pack), 'pack 不含 recentDiagnosis')

// 3. slice 上限
console.log('\n3. slice 上限')
const bigCtx = {
  ...mockCtx,
  entryFacts: Array.from({ length: 10 }, (_, i) => `fact${i}`),
  matchedMechanisms: Array.from({ length: 5 }, (_, i) => `m${i}`),
}
const sliced = pickFrontendReadPack(bigCtx)
assert(sliced.entryFacts.length === 6, `entryFacts slice 6 (got ${sliced.entryFacts.length})`)
assert(sliced.matchedMechanisms.length === 3, `matchedMechanisms slice 3 (got ${sliced.matchedMechanisms.length})`)

// 4. buildDailyProsePayload 使用 pickFrontendReadPack
console.log('\n4. buildDailyProsePayload retrievalPack 门控')
const payload = buildDailyProsePayload(
  {
    inputType: 'ask_advice',
    contextMaturityLevel: 'L3',
    relationshipToExistingModel: { type: 'consistent', explanation: '', confidence: 'medium' },
    routingDecision: {
      frontResponseType: 'analysis',
      needFollowup: false,
      followupQuestion: '',
    },
    retrievedContext: mockCtx,
    frontResponseDraft: '',
    agent: 'daily_dialogue_orchestration_agent',
    memoryAction: { type: 'none' },
  },
  '孩子写作业拖延怎么办'
)
assert(isFrontendReadPackShape(payload.retrievalPack), 'payload.retrievalPack 形状合法')
const leaks = assertNoBackendOnlyKeys(payload.retrievalPack)
assert(leaks.length === 0, `无泄漏键 (leaks=${leaks.join(',')})`)
for (const forbidden of BACKEND_ONLY_CONTEXT_FIELDS) {
  assert(!(forbidden in payload.retrievalPack), `retrievalPack 不含 ${forbidden}`)
}

// 5. prose-context 引用 pickFrontendReadPack（静态）
console.log('\n5. prose-context 引用门控模块')
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const proseSrc = readFileSync(join(root, 'src/lib/server/daily/prose-context.ts'), 'utf8')
assert(proseSrc.includes('pickFrontendReadPack'), 'prose-context 导入 pickFrontendReadPack')
assert(!/retrievalPack\s*=\s*\{[^}]*relevantChildStructureModel/.test(proseSrc),
  'prose-context 不再内联 RetrievedContext 字段名')

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`)
process.exit(fail === 0 ? 0 : 1)

// 契约测试：FrontendReadSchema / pickFrontendReadPack 门控（厚包默认 + 薄包回退）
// 运行：npx tsx scripts/test-frontend-read-pack.mjs
import {
  FRONTEND_READ_PACK_KEYS,
  BACKEND_ONLY_CONTEXT_FIELDS,
  pickFrontendReadPack,
  isFrontendReadPackShape,
  assertNoBackendOnlyKeys,
  isThickFamilyMemoryPack,
  getFrontendReadSliceLimits,
} from '../src/lib/server/daily/frontend-read-pack.ts'
import { buildDailyProsePayload } from '../src/lib/server/daily/prose-context.ts'
import {
  pickDeepModelDigestPack,
  formatMatchedMechanismCards,
} from '../src/lib/server/memory/deep-modeling/pick-deep-model-digest.ts'

let pass = 0
let fail = 0
const assert = (c, m) => {
  c ? pass++ : (fail++, console.error('  ✗', m))
}

console.log('=== FrontendReadSchema 契约测试 ===\n')

// 1. 键序稳定
console.log('1. FRONTEND_READ_PACK_KEYS 键序')
assert(FRONTEND_READ_PACK_KEYS[0] === 'childStructureModels', '首键 childStructureModels')
assert(FRONTEND_READ_PACK_KEYS.includes('dossierSlice'), '含 dossierSlice 键')
assert(FRONTEND_READ_PACK_KEYS.length === 11, `共 11 个键 (got ${FRONTEND_READ_PACK_KEYS.length})`)

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
assert(Array.isArray(pack.dossierSlice), 'dossierSlice 为数组')
assert(pack.familyPatterns[0] === '催作业→发脾气', 'familyPatterns 映射正确')
assert(!('recentDiagnosis' in pack), 'pack 不含 recentDiagnosis')

// 3. slice 上限（默认厚包）
console.log('\n3. slice 上限（当前环境）')
assert(isThickFamilyMemoryPack() === true, '默认厚包开启（未设 FAMILY_MEMORY_THICK_PACK=0）')
const limits = getFrontendReadSliceLimits()
assert(limits.entryFacts === 80, `厚包 entryFacts=80 (got ${limits.entryFacts})`)
assert(limits.matchedMechanisms === 8, `厚包 matchedMechanisms=8 (got ${limits.matchedMechanisms})`)
const bigCtx = {
  ...mockCtx,
  entryFacts: Array.from({ length: 100 }, (_, i) => `fact${i}`),
  matchedMechanisms: Array.from({ length: 60 }, (_, i) => `m${i}`),
}
const sliced = pickFrontendReadPack(bigCtx)
assert(sliced.entryFacts.length === 80, `entryFacts slice 80 (got ${sliced.entryFacts.length})`)
assert(sliced.matchedMechanisms.length === 8, `matchedMechanisms slice 8 (got ${sliced.matchedMechanisms.length})`)

// 3b. 薄包回退
console.log('\n3b. 薄包回退 FAMILY_MEMORY_THICK_PACK=0')
process.env.FAMILY_MEMORY_THICK_PACK = '0'
assert(isThickFamilyMemoryPack() === false, '薄包关闭厚包')
const thinLimits = getFrontendReadSliceLimits()
assert(thinLimits.entryFacts === 6, `薄包 entryFacts=6 (got ${thinLimits.entryFacts})`)
assert(thinLimits.matchedMechanisms === 3, `薄包 matchedMechanisms=3 (got ${thinLimits.matchedMechanisms})`)
const thinSliced = pickFrontendReadPack(bigCtx)
assert(thinSliced.entryFacts.length === 6, `薄包 entryFacts slice 6 (got ${thinSliced.entryFacts.length})`)
assert(thinSliced.matchedMechanisms.length === 3, `薄包 matchedMechanisms slice 3 (got ${thinSliced.matchedMechanisms.length})`)
delete process.env.FAMILY_MEMORY_THICK_PACK

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
assert(typeof payload.packStats === 'object', 'payload 含 packStats')
assert(payload.writingRules?.singleFocusSuggested === true, 'writingRules 建议单重点')
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
assert(proseSrc.includes('mustReadFullPack'), 'prose-context 要求通读完整 pack')
assert(proseSrc.includes('packStats'), 'prose-context 注入 packStats')
assert(proseSrc.includes('singleFocusSuggested'), 'prose-context 建议单重点')
assert(proseSrc.includes('turnRelevantSnippetsAreEntryHintOnly'), 'snippets 仅为切入提示')
assert(!/retrievalPack\s*=\s*\{[^}]*relevantChildStructureModel/.test(proseSrc),
  'prose-context 不再内联 RetrievedContext 字段名')

// 5b. turnRelevantSnippets 预筛
console.log('\n5b. turnRelevantSnippets 预筛')
import { pickTurnRelevantSnippets } from '../src/lib/server/daily/turn-relevant-snippets.ts'
const snippets = pickTurnRelevantSnippets('孩子考试考差了很沮丧', pack)
assert(snippets.length >= 1, 'turnRelevantSnippets 非空')
assert(snippets.length <= 5, 'turnRelevantSnippets 上限 5')

// 6. digest pack + 机制人话卡
console.log('\n6. digest / mechanism cards')
const digestPack = pickDeepModelDigestPack({
  mechanismNarrative: '催作业时孩子会先顶嘴再沉默',
  interactionLoops: ['催→顶→沉默'],
  anchoredFacts: ['错题本只抄答案'],
  parentVerbatimSnippets: [],
  childQuotes: ['我知道了'],
  parentInteractionStyle: '',
  preferredPacing: '',
  openHypotheses: [],
  cultivationFocus: '',
  structuralTensions: [{ title: '催与躲', detail: '一催就关房门' }],
})
assert(digestPack.structuralTensions[0]?.includes('催与躲'), 'digest 含结构张力人话')
assert(Array.isArray(digestPack.structuralTensions), 'structuralTensions 为 string[]')

const cards = formatMatchedMechanismCards([
  {
    mechanismId: 'm1',
    mechanismName: '催作业后关房门',
    description: '催促升高时孩子用关门切断接触',
    overallStrength: 'high',
    supportingEvidence: ['昨晚关了门'],
    possibleProtectiveFunction: '避开评价',
  },
  {
    mechanismId: 'm2',
    mechanismName: '低强度可忽略',
    description: 'x',
    overallStrength: 'low',
    supportingEvidence: [],
    possibleProtectiveFunction: '',
  },
])
assert(cards.length === 1, '过滤 low 强度机制')
assert(cards[0].includes('催作业后关房门'), '人话卡含机制名')
assert(cards[0].includes('依据'), '厚包人话卡含依据')

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`)
process.exit(fail === 0 ? 0 : 1)

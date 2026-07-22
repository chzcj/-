// 契约测试：v4 harness 确定性校验（confidence 钳制 / 后台 post-gate / 贝叶斯公式）
// 运行：npx tsx scripts/test-harness-gates.mjs
import { clampAtomConfidence, enforceHighValueEligibility } from '../src/lib/server/harness/confidence-clamp.ts'
import {
  gateMechanismMatrix,
  gateDossier,
  hasRetryableViolations,
  formatViolationsForRetry,
} from '../src/lib/server/harness/background-post-gate.ts'
import { computeLikelihood } from '../src/lib/server/harness/bayesian.ts'

let pass = 0
let fail = 0
const assert = (c, m) => {
  c ? pass++ : (fail++, console.error('  ✗', m))
}

console.log('=== v4 harness 契约测试 ===\n')

// 1. atom confidence 双上限钳制
console.log('1. clampAtomConfidence')
assert(clampAtomConfidence({ confidence: 0.9, epistemicStatus: 'inferred', evidenceTier: 'verbatim' }) === 0.3, 'inferred 封顶 0.3')
assert(clampAtomConfidence({ confidence: 0.9, epistemicStatus: 'hypothesized' }) === 0.2, 'hypothesized 封顶 0.2')
assert(clampAtomConfidence({ confidence: 0.95, epistemicStatus: 'observed', evidenceTier: 'verbatim' }) === 0.85, 'verbatim tier 封顶 0.85')
assert(clampAtomConfidence({ epistemicStatus: 'reported' }) === 0.5, '无 tier 的 reported 默认 0.5')
assert(clampAtomConfidence({ confidence: 0.3, epistemicStatus: 'observed', evidenceTier: 'outcome_checked' }) === 0.3, 'LLM 低打分不被抬高')

// 2. 高价值资格
console.log('2. enforceHighValueEligibility')
assert(enforceHighValueEligibility(true, 'inferred') === false, 'inferred 强制非高价值')
assert(enforceHighValueEligibility(true, 'hypothesized') === false, 'hypothesized 强制非高价值')
assert(enforceHighValueEligibility(true, 'observed') === true, 'observed 保留高价值')

// 3. 机制矩阵 gate
console.log('3. gateMechanismMatrix')
const mkMech = (over) => ({
  mechanismName: '强制循环理论：妈妈催-孩子拖-妈妈退让',
  description: '妈妈在作业开始前反复催促，孩子拖延，妈妈最终退让替他整理，孩子学会拖到妈妈接手，循环在多个晚上重复出现',
  supportingEvidence: ['事实1', '事实2', '事实3'],
  overallStrength: 'high',
  theoryCardId: 'coercive_cycle',
  shouldPromoteToDiagnosis: false,
  ...over,
})
const validCards = new Set(['coercive_cycle', 'attachment'])

const g1 = gateMechanismMatrix([mkMech({ supportingEvidence: [] , evidenceRefs: undefined })], validCards)
assert(g1.fixed.length === 0 && g1.violations.some((v) => v.code === 'NO_EVIDENCE_DROPPED'), '零证据丢弃')

const g2 = gateMechanismMatrix([mkMech({ mechanismName: '拖延机制' })], validCards)
assert(g2.violations.some((v) => v.code === 'INTERMEDIATE_VARIABLE' && v.retryable), '中间变量名 retryable')
assert(hasRetryableViolations(g2.violations), 'hasRetryableViolations 检出')
assert(formatViolationsForRetry(g2.violations).includes('拖延机制'), '重试反馈含违规详情')

const g3 = gateMechanismMatrix([mkMech({ supportingEvidence: ['事实1', '事实2'] })], validCards)
assert(g3.fixed[0].overallStrength === 'medium' && g3.violations.some((v) => v.code === 'OVERCONFIDENT_STRENGTH'), '2 证据 high 降 medium')

const g4 = gateMechanismMatrix([mkMech({ supportingEvidence: ['事实1'] })], validCards)
assert(g4.fixed[0].overallStrength === 'low' && g4.fixed[0].shouldPromoteToDiagnosis === false, '<2 证据封顶 low 禁晋升')

const g5 = gateMechanismMatrix([mkMech({ theoryCardId: 'fake_card' })], validCards)
assert(g5.fixed[0].theoryCardId === undefined && g5.violations.some((v) => v.code === 'UNKNOWN_THEORY_CARD'), '伪造卡 ID 清除')

const mechA = mkMech({})
const mechB = mkMech({
  mechanismName: '依恋理论：冲突后无修复',
  theoryCardId: 'attachment',
  relatedMechanismIds: [
    { fromMechanismId: '依恋理论：冲突后无修复', toMechanismId: '强制循环理论：妈妈催-孩子拖-妈妈退让', relation: 'competesWith', weight: 0.5, evidenceRefs: [] },
    { fromMechanismId: '依恋理论：冲突后无修复', toMechanismId: '不存在的机制', relation: 'reinforces', weight: 0.5, evidenceRefs: [] },
  ],
})
const g6 = gateMechanismMatrix([mechA, mechB], validCards)
const gatedB = g6.fixed.find((m) => m.theoryCardId === 'attachment')
assert(gatedB.relatedMechanismIds?.length === 1, '悬空边剔除、有效边保留')
assert(g6.violations.some((v) => v.code === 'DANGLING_MECHANISM_EDGE'), '悬空边违规记录')

// 4. dossier gate
console.log('4. gateDossier')
const mkDossier = (over) => ({
  version: 1,
  changeLog: [],
  familyStruct: [{ label: '母-子二元过度紧密', confidence: 0.78, evidenceSummary: '作业/手机/情绪 3 场景' }],
  fivePs: {
    perpetuating: [{ id: 'M1', label: '做完即加任务', confidence: 0.9, evidenceSummary: '单次抱怨' }],
    protective: [{ id: 'PR_t1', label: '沉默保护不被追问', confidence: 0.9, evidenceSummary: '3/4 场景反复出现' }],
  },
  sceneReadings: [
    { scene: '作业前', reading: '守住边界' },
    { scene: '冲突后', reading: '喘息' },
  ],
  parentPerspectives: [],
  workingHypothesis: { text: '孩子用拖延守住休息边界', predictions: [{ id: 'pred_1', text: '不加码则拖延减少' }] },
  interventionTargets: [],
  integratedSynthesis: '一段人话',
  alternativeReadings: [{ id: 'H_B', hypothesis: '也可能是题太难', confidence: 0.4 }],
  updatedAt: '',
  ...over,
})

const d1 = gateDossier(mkDossier({}))
assert(!hasRetryableViolations(d1.violations), '合规 dossier 无 retryable 违规')
assert(d1.fixed.fivePs.perpetuating[0].confidence === 0.7, '0.9 无跨场景标记钳到 0.7')
assert(d1.fixed.fivePs.protective[0].confidence === 0.9, '有跨场景标记(3/4 场景)保留 0.9')

const d2 = gateDossier(mkDossier({ workingHypothesis: { text: '孩子存在强制循环与依恋型回避', predictions: [{ id: 'p', text: 't' }] } }))
assert(d2.violations.some((v) => v.code === 'THEORY_LEAK' && v.retryable), '理论名泄漏 retryable')

const d3 = gateDossier(mkDossier({ sceneReadings: [{ scene: '作业前', reading: 'x' }], alternativeReadings: [] }))
assert(d3.violations.some((v) => v.code === 'SCENE_INTERWEAVE_MISSING'), '单场景违规')
assert(d3.violations.some((v) => v.code === 'NO_ALTERNATIVE_READING'), '无竞争假设违规')

const d4 = gateDossier(mkDossier({ workingHypothesis: { text: '有假设无预测', predictions: [] } }))
assert(d4.violations.some((v) => v.code === 'PREDICTIONS_MISSING'), '不可证伪违规')

// 5. 贝叶斯似然
console.log('5. computeLikelihood')
const base = { hypothesisId: 'h1', prior: 0.5, supportingCount: 0, contradictingCount: 0, avgEvidenceConfidence: 0.6 }
assert(computeLikelihood(base) === 0.5, '无新证据 likelihood=prior')
assert(computeLikelihood({ ...base, supportingCount: 3 }) > 0.5, '支持证据抬升')
assert(computeLikelihood({ ...base, contradictingCount: 3 }) < 0.5, '反证压低')
assert(computeLikelihood({ ...base, contradictingCount: 100 }) >= 0.01, '下限 0.01')

console.log(`\n结果：${pass} 通过，${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)

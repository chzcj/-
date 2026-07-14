// 家长面机制切片契约
// 运行：npx tsx scripts/test-parent-mechanism-view.mjs
import {
  pickTopMechanismCards,
  pickDynamicChainCells,
  sanitizeMechanismTitleForParent,
} from '../src/lib/server/profile/parent-mechanism-view.ts'

let pass = 0
let fail = 0
const assert = (c, m) => {
  c ? pass++ : (fail++, console.error('  ✗', m))
}

console.log('=== parent-mechanism-view ===\n')

assert(
  !sanitizeMechanismTitleForParent('家庭系统-三角关系：催作业关房门').includes('家庭系统'),
  '洗掉理论前缀'
)
assert(sanitizeMechanismTitleForParent('催作业后关房门').includes('催作业'), '保留人话名')

const cards = pickTopMechanismCards(
  [
    {
      mechanismName: '亲职风格-专制型：催促升高',
      mechanismType: 'core_candidate',
      description: '催促升高时孩子用关门切断接触',
      supportedByEntries: [],
      supportingEvidence: ['昨晚关了门'],
      explainedBehaviors: [],
      possibleProtectiveFunction: '避开评价',
      familyInteractionChain: {
        parentTriggerAction: '催快点写',
        parentReasonableGoal: '',
        childReception: '又在逼我',
        childReaction: '关门',
        parentSecondInterpretation: '',
        parentReinforcementAction: '',
        childFurtherStrategy: '',
        longTermEffect: '',
      },
      scores: {},
      overallStrength: 'high',
      applicableScope: '',
      missingEvidence: [],
      possibleAlternativeExplanations: [],
      shouldPromoteToDiagnosis: false,
    },
    {
      mechanismName: '低强度',
      mechanismType: 'local_candidate',
      description: 'x',
      supportedByEntries: [],
      supportingEvidence: [],
      explainedBehaviors: [],
      possibleProtectiveFunction: '',
      familyInteractionChain: {
        parentTriggerAction: '',
        parentReasonableGoal: '',
        childReception: '',
        childReaction: '',
        parentSecondInterpretation: '',
        parentReinforcementAction: '',
        childFurtherStrategy: '',
        longTermEffect: '',
      },
      scores: {},
      overallStrength: 'low',
      applicableScope: '',
      missingEvidence: [],
      possibleAlternativeExplanations: [],
      shouldPromoteToDiagnosis: false,
    },
  ],
  5
)

assert(cards.length === 1, '过滤 low')
assert(cards[0].role === 'primary', '主卡')
assert(cards[0].fact.includes('关了门'), '有事实')

const cells = pickDynamicChainCells({
  matrix: [
    {
      mechanismName: '催促',
      mechanismType: 'core_candidate',
      description: 'd',
      supportedByEntries: [],
      supportingEvidence: [],
      explainedBehaviors: [],
      possibleProtectiveFunction: '',
      familyInteractionChain: {
        parentTriggerAction: '催快点写',
        parentReasonableGoal: '',
        childReception: '又在逼我',
        childReaction: '关门',
        parentSecondInterpretation: '',
        parentReinforcementAction: '',
        childFurtherStrategy: '',
        longTermEffect: '',
      },
      scores: {},
      overallStrength: 'medium',
      applicableScope: '',
      missingEvidence: [],
      possibleAlternativeExplanations: [],
      shouldPromoteToDiagnosis: false,
    },
  ],
})
assert(cells.length === 3, `空格隐藏 → 3 格 (got ${cells.length})`)
assert(!cells.some((c) => !c.text), '无空 text')

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`)
process.exit(fail === 0 ? 0 : 1)

import type { EcosystemLayer } from '@/types/database'

/** Rich theory card — 报告 15×9 字段对齐；MVP 8 张先行完整填充 */
export type TheoryCardRich = {
  coreViewpoint?: string
  judgmentDimensions?: string[]
  confidenceRules?: string
  recommendedInterventions?: string[]
  tabooAdvice?: string[]
  parentFacingExpression?: string
  outputConstraints?: string
}

export type TheoryCard = {
  id: string
  name: string
  ecosystemLayer: EcosystemLayer
  applicableScenarios: string[]
  observationSignals: string[]
  rich?: TheoryCardRich
}

const RICH_APPENDIX_NOTE =
  '（附录卡：判断时自检适用场景与观察信号，置信度上限 medium，禁止单独作为前台主解释）'

function legacyCard(
  id: string,
  name: string,
  ecosystemLayer: EcosystemLayer,
  applicableScenarios: string[],
  observationSignals: string[]
): TheoryCard {
  return { id, name, ecosystemLayer, applicableScenarios, observationSignals }
}

/** 20 张理论卡（MVP 8 张 rich；其余保持原名 + 附录降级） */
export const THEORY_CARDS: TheoryCard[] = [
  {
    id: 'behavioral_vs_psychological_control',
    name: '行为控制与心理控制',
    ecosystemLayer: 'micro',
    applicableScenarios: ['作业冲突', '电子产品', '拖延顶嘴', '羞辱式激励'],
    observationSignals: ['规则是否明确', '是否撤回爱', '是否羞辱比较', '规则前后一致'],
    rich: {
      coreViewpoint: '行为控制（规则、监控）与心理控制（撤回爱、 guilt、羞辱）对孩子自主与情绪的影响不同；中国语境下「为你好」常掩盖心理控制。',
      judgmentDimensions: ['rule_clarity', 'psychological_intrusion', 'consistency'],
      confidenceRules: '须同时有具体互动片段 + 孩子反应 + 至少两次类似场景，才可 high；仅家长自述「管得严」→ medium 上限。',
      recommendedInterventions: ['区分安全边界与监控密度', '把命令改成可协商的小选择'],
      tabooAdvice: ['把所有管教都称为控制欲', '未区分行为控制与心理控制'],
      parentFacingExpression: '孩子可能不是在「对抗规则」，而是在躲一种被盯着、被否定的感觉。',
      outputConstraints: 'micro 层；不得用此卡解释宏观升学压力 alone。',
    },
  },
  {
    id: 'coercive_cycle',
    name: '强制循环理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['反复吼叫', '顶嘴升级', '磨蹭', '公共场景失控'],
    observationSignals: ['谁先升级', '谁退让', '退让后短期收益', '模仿父母语气'],
    rich: {
      coreViewpoint: '亲子冲突常形成「升级—退让—短期平息—再犯」循环；谁退让决定了循环的锁定方向。',
      judgmentDimensions: ['escalation_initiator', 'coercion_exit', 'short_term_payoff'],
      confidenceRules: '须还原至少一轮完整事件链（触发→升级→孩子反应→家长二次反应），单次冲突不得定 stable。',
      recommendedInterventions: ['打断升级节点', '试一次不追到底'],
      tabooAdvice: ['单方面归咎孩子脾气', '忽略家长二次反应'],
      parentFacingExpression: '这次可能不是谁脾气差，而是你们已经习惯用「谁声音大谁赢」来结束场面。',
      outputConstraints: 'micro；需事件链证据。',
    },
  },
  {
    id: 'parenting_style',
    name: '亲职风格理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['高要求低回应', '管教方式', '规则与解释'],
    observationSignals: ['高要求是否配解释', '情绪回应', '是否只强调服从'],
    rich: {
      coreViewpoint: '高要求需配情感回应与解释，否则易体验为 authoritarian 而非 authoritative。',
      judgmentDimensions: ['demandingness', 'responsiveness', 'explanation_quality'],
      confidenceRules: 'high 需观察到要求+回应+解释在同一场景的同时出现或稳定缺失。',
      recommendedInterventions: ['高要求场景加一句解释', '冲突后补情感回应'],
      tabooAdvice: ['贴「专制型家长」标签'],
      parentFacingExpression: '你不是不够严，可能是孩子只收到要求，没收到「我还在这儿」。',
      outputConstraints: 'micro',
    },
  },
  {
    id: 'attachment',
    name: '依恋理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['受挫后退缩', '不敢表达', '冲突后冷战'],
    observationSignals: ['是否敢求助', '重聚反应', '冲突后修复'],
    rich: {
      coreViewpoint: '安全感来自可预测的回应与冲突后修复，而非零冲突。',
      judgmentDimensions: ['seeking_comfort', 'reunion_response', 'repair_after_conflict'],
      confidenceRules: '须见冲突后修复过程或稳定缺失；不得仅凭「内向」推断 insecure。',
      recommendedInterventions: ['冲突后 24h 内修复性接触', '降低求助门槛'],
      tabooAdvice: ['称孩子依恋障碍', '忽略修复缺失'],
      parentFacingExpression: '他沉默时，可能不是在惩罚你，而是在等一个「还能和好」的信号。',
      outputConstraints: 'micro；修复证据优先。',
    },
  },
  {
    id: 'family_function',
    name: '家庭功能理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['沟通断裂', '规则混乱', '情绪无人回应'],
    observationSignals: ['能否一起解决问题', '情感回应', '角色分工'],
    rich: { coreViewpoint: '家庭在问题解决、情感回应、角色清晰上的功能影响孩子调节。', outputConstraints: 'micro' },
  },
  {
    id: 'family_communication',
    name: '家庭沟通理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['指责讨好', '超理智讲道理', '打岔回避'],
    observationSignals: ['沟通姿态', '是否对事对人', '孩子是否被听见'],
    rich: { coreViewpoint: '指责、讨好、超理智、打岔四种姿态会阻断孩子被听见感。', outputConstraints: 'micro' },
  },
  {
    id: 'emotion_socialization',
    name: '情绪社会化理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['情绪被否定', '哭被骂', '只许高兴'],
    observationSignals: ['情绪回应模式', '惩罚或缩小情绪', '情绪命名能力'],
    rich: { coreViewpoint: '情绪被否定会让孩子学会隐藏或放大情绪表达。', outputConstraints: 'micro' },
  },
  {
    id: 'self_determination',
    name: '自我决定理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['作业自主', '兴趣被安排', '选择权少'],
    observationSignals: ['自主感', '胜任感', '归属感是否被支持'],
    rich: {
      coreViewpoint: '自主、胜任、归属三种基本需要受挫时，孩子用回避、对抗或退缩维持自我。',
      judgmentDimensions: ['autonomy_support', 'competence_support', 'relatedness_support'],
      confidenceRules: '须区分「没管」与「支持自主」；放任 ≠ autonomy support。',
      recommendedInterventions: ['给边界内选择权', '任务拆小提升胜任感'],
      tabooAdvice: ['把自主支持说成放任'],
      parentFacingExpression: '他不是不想做好，可能是这一晚没有任何一块时间 feels 像自己的。',
      outputConstraints: 'micro',
    },
  },
  legacyCard('family_systems', '家庭系统理论', 'meso', ['三角关系', '边界纠缠', '孩子站队'], ['夫妻冲突转嫁', '祖辈越级', '边界清晰与否']),
  {
    id: 'coparenting',
    name: '共同养育理论',
    ecosystemLayer: 'meso',
    applicableScenarios: ['父母口径不一', '一个管一个拆台', '祖辈介入'],
    observationSignals: ['当面否定对方', '规则不一致', '分工失衡'],
    rich: {
      coreViewpoint: '养育者联盟与口径一致影响孩子规则体验；拆台会放大对抗。',
      judgmentDimensions: ['coparenting_alliance', 'undermining', 'role_clarity'],
      confidenceRules: '须观察到当面拆台或规则冲突实例，不得推断离异必然 coparenting 差。',
      recommendedInterventions: ['私下对齐再执行', '避免当面否定'],
      tabooAdvice: ['父母离异=共同养育差'],
      parentFacingExpression: '孩子有时不是在选边站，而是在利用「规则不一致」找喘息。',
      outputConstraints: 'meso',
    },
  },
  legacyCard('family_boundaries', '家庭边界理论', 'meso', ['父母化', '代际越界', '角色错位'], ['孩子是否承担调节责任', '代际边界', '角色是否清晰']),
  {
    id: 'home_school_partnership',
    name: '家校合作与家长参与',
    ecosystemLayer: 'meso',
    applicableScenarios: ['只在出事时联系老师', '家校目标不一致'],
    observationSignals: ['联系是否双向', '是否围绕可执行目标', '频率是否代替质量'],
    rich: {
      coreViewpoint: '家校协同质量看目标一致与可执行沟通，非联系频率 alone。',
      judgmentDimensions: ['goal_alignment', 'bidirectional_communication', 'actionable_plans'],
      confidenceRules: '频繁联系老师 ≠ 协同好；须看是否围绕可执行目标。',
      recommendedInterventions: ['与老师对齐一个可观察的小目标'],
      tabooAdvice: ['把联系少等同于不关心'],
      parentFacingExpression: '和老师沟通多不多不是关键，关键是你们是否在朝同一个可执行的小目标走。',
      outputConstraints: 'meso；外系统不可替代个体证据。',
    },
  },
  legacyCard('abc_x_stress', '双ABC-X家庭压力模型', 'exo', ['经济压力', '父母易怒', '资源不足'], ['外部压力', '父母情绪变化', '夫妻冲突增多']),
  legacyCard('social_capital', '社会资本理论', 'exo', ['社区支持弱', '隔代照料', '外部资源少'], ['家庭外支持网', '学校参与', '亲子关系质量']),
  legacyCard('sociocultural_scaffolding', '社会文化发展与脚手架', 'exo', ['代劳作业', '超前要求', '辅导越界'], ['最近发展区', '脚手架还是代劳', '任务难度匹配']),
  legacyCard('dual_filial_piety', '双元孝道模型', 'macro', ['为你好', '孝顺义务', '听话与体面'], ['权威服从脚本', '感恩互惠', '家族名誉压力']),
  legacyCard('ecological_systems', '生态系统理论', 'macro', ['升学文化', '社会期待', '比较竞争'], ['文化脚本', '环境压力层', '跨系统影响']),
  {
    id: 'stage_environment_fit',
    name: '阶段-环境匹配理论',
    ecosystemLayer: 'chrono',
    applicableScenarios: ['升学转折', '青春期', '转学搬家'],
    observationSignals: ['转折前后对比', '自主感变化', '评价方式变化'],
    rich: {
      coreViewpoint: '发展任务与环境要求不匹配时，孩子用退缩或对抗适应。',
      judgmentDimensions: ['stage_task', 'environment_demands', 'mismatch_signs'],
      confidenceRules: '须见转折前后对比；年龄典型行为不先病理化。',
      recommendedInterventions: ['降低环境与阶段任务错配', '增加过渡脚手架'],
      tabooAdvice: ['把青春期正常波动病理化'],
      parentFacingExpression: '上初中后变样，可能不全是态度问题，而是任务和环境突然换档了。',
      outputConstraints: 'chrono',
    },
  },
  {
    id: 'family_life_cycle',
    name: '家庭生命周期理论',
    ecosystemLayer: 'chrono',
    applicableScenarios: ['学龄期任务', '青春期过渡', '家庭阶段压力'],
    observationSignals: ['阶段发展任务', '过渡压力', '角色重新协商'],
    rich: {
      coreViewpoint: '家庭在学龄、青春期等过渡段有重新协商角色与规则的任务。',
      judgmentDimensions: ['developmental_task', 'transition_stress'],
      confidenceRules: '须对齐具体家庭阶段事件，不得泛化。',
      recommendedInterventions: ['显式重新协商规则与分工'],
      parentFacingExpression: '你们可能都在适应一个新阶段，不只是孩子在「变难搞」。',
      outputConstraints: 'chrono',
    },
  },
  {
    id: 'erikson_stage',
    name: '心理社会发展理论',
    ecosystemLayer: 'chrono',
    applicableScenarios: ['勤勉自卑', '认同混乱', '年龄任务冲突'],
    observationSignals: ['阶段任务', '能力感', '角色认同线索'],
    rich: {
      coreViewpoint: '学龄期勤勉 vs 自卑、青春期认同 vs 混乱等阶段任务影响压力表现。',
      judgmentDimensions: ['industry_vs_inferiority', 'identity_vs_confusion'],
      confidenceRules: '须与年龄任务和具体能力感证据对齐。',
      recommendedInterventions: ['放大小胜任体验', '减少公开比较'],
      parentFacingExpression: '他怕的不是题难，是在这个年龄段特别怕「被看出不行」。',
      outputConstraints: 'chrono；发展任务卡 MVP 第一批。',
    },
  },
]

/** 附录降级卡（报告未列全 rich 的 10+ 张）— SP 自检用 */
export const THEORY_CARDS_APPENDIX_IDS = THEORY_CARDS.filter((c) => !c.rich?.coreViewpoint).map((c) => c.id)

export function theoryCardsForLayer(layer: EcosystemLayer): TheoryCard[] {
  return THEORY_CARDS.filter((c) => c.ecosystemLayer === layer)
}

export function theoryCardsSystemAppendix(): string {
  const appendix = THEORY_CARDS.filter((c) => !c.rich?.coreViewpoint)
    .map((c) => `- ${c.name}（${c.id}）${RICH_APPENDIX_NOTE}`)
    .join('\n')
  return `## 附录理论卡（降级自检）\n${appendix}`
}

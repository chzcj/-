import type { EcosystemLayer } from '@/types/database'

/** Rich theory card — 20×9 字段（v4 全量补齐） */
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

/** 20 张理论卡（v4：全部 rich 9 字段） */
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
    rich: {
      coreViewpoint: '家庭在问题解决、情感回应、角色清晰上的功能影响孩子调节。',
      judgmentDimensions: ['problem_solving', 'affective_responsiveness', 'role_allocation'],
      confidenceRules: '须有一次完整问题处理过程（谁提出/如何商量/结果）或稳定缺失的多场景证据；单次失败不得定 low functioning。',
      recommendedInterventions: ['挑一件小事完整走一遍「一起解决」', '给情绪先回应再处理事'],
      tabooAdvice: ['给家庭贴「功能失调」标签'],
      parentFacingExpression: '不是你们不关心，可能是家里还没有一条「事情怎么一起办」的顺路。',
      outputConstraints: 'micro',
    },
  },
  {
    id: 'family_communication',
    name: '家庭沟通理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['指责讨好', '超理智讲道理', '打岔回避'],
    observationSignals: ['沟通姿态', '是否对事对人', '孩子是否被听见'],
    rich: {
      coreViewpoint: '指责、讨好、超理智、打岔四种姿态会阻断孩子被听见感。',
      judgmentDimensions: ['stance_pattern', 'person_vs_issue', 'child_feels_heard'],
      confidenceRules: '须有对话原话或可还原的对话片段才可判断姿态；家长自述「我都好好说了」不算证据。',
      recommendedInterventions: ['把「你怎么又」换成「这次哪一步卡住了」', '孩子说完前不接话'],
      tabooAdvice: ['给家长贴「指责型」标签'],
      parentFacingExpression: '你说的道理他可能都懂，他没接住的是「先被说错」的那一下。',
      outputConstraints: 'micro；须对话证据。',
    },
  },
  {
    id: 'emotion_socialization',
    name: '情绪社会化理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['情绪被否定', '哭被骂', '只许高兴'],
    observationSignals: ['情绪回应模式', '惩罚或缩小情绪', '情绪命名能力'],
    rich: {
      coreViewpoint: '情绪被否定会让孩子学会隐藏或放大情绪表达。',
      judgmentDimensions: ['emotion_response_style', 'dismissing_vs_coaching', 'emotion_vocabulary'],
      confidenceRules: '须有情绪事件的回应片段（孩子哭/怒时家长第一反应）为证；「他从不跟我说」本身可能就是结果而非起点。',
      recommendedInterventions: ['情绪先命名再讲道理', '允许难受存在五分钟'],
      tabooAdvice: ['要求孩子「控制情绪」作为第一步'],
      parentFacingExpression: '他不说，可能不是没话，是之前几次说了之后更难受。',
      outputConstraints: 'micro；须情绪回应证据。',
    },
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
  {
    id: 'family_systems',
    name: '家庭系统理论',
    ecosystemLayer: 'meso',
    applicableScenarios: ['三角关系', '边界纠缠', '孩子站队'],
    observationSignals: ['夫妻冲突转嫁', '祖辈越级', '边界清晰与否'],
    rich: {
      coreViewpoint: '孩子的症状常是家庭系统失衡的调节器：夫妻张力未解时，孩子可能被拉入三角（站队/传话/用问题转移焦点）。',
      judgmentDimensions: ['triangulation_present', 'subsystem_boundary', 'conflict_detour_via_child'],
      confidenceRules: '高误判卡：须较完整关系图 + ≥2 个冲突场景（谁拉谁、孩子如何被卷入）才可 high；单方抱怨配偶不参与 → medium 上限；防把文化性亲密误读为纠缠。',
      recommendedInterventions: ['夫妻分歧不当着孩子处理', '把孩子从传话/评理位置上撤下来'],
      tabooAdvice: ['归咎某一方「有问题」', '要求孩子理解大人难处'],
      parentFacingExpression: '孩子夹在你们中间时，他的「问题」有时是在替家里降温。',
      outputConstraints: 'meso；须关系图证据，不得仅凭单方叙述定三角。',
    },
  },
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
  {
    id: 'family_boundaries',
    name: '家庭边界理论',
    ecosystemLayer: 'meso',
    applicableScenarios: ['父母化', '代际越界', '角色错位'],
    observationSignals: ['孩子是否承担调节责任', '代际边界', '角色是否清晰'],
    rich: {
      coreViewpoint: '代际边界错位——孩子承担父母的情绪调节/仲裁职责，或父母全面接管孩子领地——会让孩子过载，或没有空间长出自主。',
      judgmentDimensions: ['parentification', 'intergenerational_intrusion', 'role_clarity'],
      confidenceRules: '高误判卡：须较完整关系图 + ≥2 个体现角色错位的具体场景才可 high；「孩子很懂事」单证据 → low；防把文化性亲密误读为越界。',
      recommendedInterventions: ['把大人议题移出孩子的知情范围', '归还孩子领地内的小决定权'],
      tabooAdvice: ['给家庭贴「纠缠」标签', '一刀切要求「分清界限」'],
      parentFacingExpression: '他小小年纪就在照看大人的情绪，那份重量可能正从别处漏出来。',
      outputConstraints: 'meso；须角色错位场景证据。',
    },
  },
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
  {
    id: 'abc_x_stress',
    name: '双ABC-X家庭压力模型',
    ecosystemLayer: 'exo',
    applicableScenarios: ['经济压力', '父母易怒', '资源不足'],
    observationSignals: ['外部压力', '父母情绪变化', '夫妻冲突增多'],
    rich: {
      coreViewpoint: '压力事件(A)×家庭资源(B)×家庭对事件的解读(C)共同决定是否滚成危机(X)；压力累积叠加旧账时，家庭对孩子的容错骤降。',
      judgmentDimensions: ['stressor_pileup', 'resource_adequacy', 'family_appraisal'],
      confidenceRules: '须指认具体压力源（裁员/生病/搬家/二胎）及其时间线与家庭反应变化才可 high；仅「最近脾气差」→ low。',
      recommendedInterventions: ['先减家长负荷再谈管教方式', '把外部压力对孩子显性化说明'],
      tabooAdvice: ['把压力期的严厉解读为教养风格定型'],
      parentFacingExpression: '家里最近扛的事多，孩子接住的火气可能不全是他招来的。',
      outputConstraints: 'exo；只能做情境解释，不能替代亲子互动的个体证据。',
    },
  },
  {
    id: 'social_capital',
    name: '社会资本理论',
    ecosystemLayer: 'exo',
    applicableScenarios: ['社区支持弱', '隔代照料', '外部资源少'],
    observationSignals: ['家庭外支持网', '学校参与', '亲子关系质量'],
    rich: {
      coreViewpoint: '家庭可动用的支持网（亲属/学校/社区）质量决定育儿余量；支持人数≠支持可用，关键看需要时能否真正接住。',
      judgmentDimensions: ['support_availability', 'support_usability', 'parent_school_closure'],
      confidenceRules: '须有具体求助事件为证（找了谁/结果如何）；仅凭居住结构（如与祖辈同住）不得推断支持质量。',
      recommendedInterventions: ['盘点一个真能搭手的具体节点', '把孤军奋战的环节显性化'],
      tabooAdvice: ['把隔代照料默认为资源或默认为干扰'],
      parentFacingExpression: '很多事你一个人扛着，孩子感受到的紧，可能有一部分来自这里。',
      outputConstraints: 'exo；情境层解释。',
    },
  },
  {
    id: 'sociocultural_scaffolding',
    name: '社会文化发展与脚手架',
    ecosystemLayer: 'exo',
    applicableScenarios: ['代劳作业', '超前要求', '辅导越界'],
    observationSignals: ['最近发展区', '脚手架还是代劳', '任务难度匹配'],
    rich: {
      coreViewpoint: '有效辅导发生在孩子踮脚够得着的区间：给略高于现有水平的支持并逐步撤除；代劳与超前要求都不产生能力，只产生依赖或挫败。',
      judgmentDimensions: ['zpd_match', 'scaffold_vs_takeover', 'gradual_release'],
      confidenceRules: '须有具体辅导片段（谁做了哪一步/孩子卡在哪）才可判断；仅「陪写作业」不足以启动本卡。',
      recommendedInterventions: ['从代劳退到提示', '把任务切到孩子踮脚够得着的一档'],
      tabooAdvice: ['一刀切「让他自己来」', '把辅导密度当投入证明'],
      parentFacingExpression: '题是会了，但会的过程如果都是你的，他下次还是不敢自己开始。',
      outputConstraints: 'exo；须辅导过程证据。',
    },
  },
  {
    id: 'dual_filial_piety',
    name: '双元孝道模型',
    ecosystemLayer: 'macro',
    applicableScenarios: ['为你好', '孝顺义务', '听话与体面'],
    observationSignals: ['权威服从脚本', '感恩互惠', '家族名誉压力'],
    rich: {
      coreViewpoint: '孝道有互惠（恩情回应）与权威（服从义务）两条脚本；权威脚本高压时「听话」变成关系货币，孩子用阳奉阴违或沉默保全双方体面。',
      judgmentDimensions: ['authoritarian_script', 'reciprocal_script', 'face_pressure'],
      confidenceRules: '文化价值类高误判卡：须有具体话语为据（「我们为你付出多少」「不听话对得起谁」），禁止仅因中国家庭背景启动；无话语证据 → low。',
      recommendedInterventions: ['把「为你好」翻译成可商量的具体事', '给不同意留一个不失礼的出口'],
      tabooAdvice: ['批判家长价值观', '把孝道本身病理化'],
      parentFacingExpression: '他不是不领情，可能是「必须领情」这件事让他喘不过气。',
      outputConstraints: 'macro；须话语证据，只能做价值情境解释。',
    },
  },
  {
    id: 'ecological_systems',
    name: '生态系统理论',
    ecosystemLayer: 'macro',
    applicableScenarios: ['升学文化', '社会期待', '比较竞争'],
    observationSignals: ['文化脚本', '环境压力层', '跨系统影响'],
    rich: {
      coreViewpoint: '升学竞争、比较文化等宏观脚本经由家长焦虑传导进日常互动；孩子对抗的常不是家长本人，而是家长身后的评价体系。',
      judgmentDimensions: ['cultural_script_transmission', 'comparison_pressure', 'cross_layer_pathway'],
      confidenceRules: '文化价值类高误判卡：须指认具体传导路径（如群里晒排名→当晚加练）才可 medium+；泛泛「内卷」「大环境」不得作为机制证据。',
      recommendedInterventions: ['切断一条具体的焦虑传导链', '在家里留一块不被比较的领地'],
      tabooAdvice: ['用大环境为一切互动问题开脱'],
      parentFacingExpression: '有些压力不是你给的，但可能正借你的嘴传到他耳朵里。',
      outputConstraints: 'macro；只能情境解释，不能替代个体证据。',
    },
  },
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
  const degraded = THEORY_CARDS.filter((c) => !c.rich?.coreViewpoint)
  if (degraded.length === 0) return ''
  const appendix = degraded
    .map((c) => `- ${c.name}（${c.id}）${RICH_APPENDIX_NOTE}`)
    .join('\n')
  return `## 附录理论卡（降级自检）\n${appendix}`
}

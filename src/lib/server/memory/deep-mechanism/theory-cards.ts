import type { EcosystemLayer } from '@/types/database'

export type TheoryCard = {
  id: string
  name: string
  ecosystemLayer: EcosystemLayer
  applicableScenarios: string[]
  observationSignals: string[]
}

/** 20 张理论卡（对齐 deepMechanismReview 框架；供 theoryMatcher 多域匹配） */
export const THEORY_CARDS: TheoryCard[] = [
  {
    id: 'behavioral_vs_psychological_control',
    name: '行为控制与心理控制',
    ecosystemLayer: 'micro',
    applicableScenarios: ['作业冲突', '电子产品', '拖延顶嘴', '羞辱式激励'],
    observationSignals: ['规则是否明确', '是否撤回爱', '是否羞辱比较', '规则前后一致'],
  },
  {
    id: 'coercive_cycle',
    name: '强制循环理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['反复吼叫', '顶嘴升级', '磨蹭', '公共场景失控'],
    observationSignals: ['谁先升级', '谁退让', '退让后短期收益', '模仿父母语气'],
  },
  {
    id: 'parenting_style',
    name: '亲职风格理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['高要求低回应', '管教方式', '规则与解释'],
    observationSignals: ['高要求是否配解释', '情绪回应', '是否只强调服从'],
  },
  {
    id: 'attachment',
    name: '依恋理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['受挫后退缩', '不敢表达', '冲突后冷战'],
    observationSignals: ['是否敢求助', '重聚反应', '冲突后修复'],
  },
  {
    id: 'family_function',
    name: '家庭功能理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['沟通断裂', '规则混乱', '情绪无人回应'],
    observationSignals: ['能否一起解决问题', '情感回应', '角色分工'],
  },
  {
    id: 'family_communication',
    name: '家庭沟通理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['指责讨好', '超理智讲道理', '打岔回避'],
    observationSignals: ['沟通姿态', '是否对事对人', '孩子是否被听见'],
  },
  {
    id: 'emotion_socialization',
    name: '情绪社会化理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['情绪被否定', '哭被骂', '只许高兴'],
    observationSignals: ['情绪回应模式', '惩罚或缩小情绪', '情绪命名能力'],
  },
  {
    id: 'self_determination',
    name: '自我决定理论',
    ecosystemLayer: 'micro',
    applicableScenarios: ['作业自主', '兴趣被安排', '选择权少'],
    observationSignals: ['自主感', '胜任感', '归属感是否被支持'],
  },
  {
    id: 'family_systems',
    name: '家庭系统理论',
    ecosystemLayer: 'meso',
    applicableScenarios: ['三角关系', '边界纠缠', '孩子站队'],
    observationSignals: ['夫妻冲突转嫁', '祖辈越级', '边界清晰与否'],
  },
  {
    id: 'coparenting',
    name: '共同养育理论',
    ecosystemLayer: 'meso',
    applicableScenarios: ['父母口径不一', '一个管一个拆台', '祖辈介入'],
    observationSignals: ['当面否定对方', '规则不一致', '分工失衡'],
  },
  {
    id: 'family_boundaries',
    name: '家庭边界理论',
    ecosystemLayer: 'meso',
    applicableScenarios: ['父母化', '代际越界', '角色错位'],
    observationSignals: ['孩子是否承担调节责任', '代际边界', '角色是否清晰'],
  },
  {
    id: 'home_school_partnership',
    name: '家校合作与家长参与',
    ecosystemLayer: 'meso',
    applicableScenarios: ['只在出事时联系老师', '家校目标不一致'],
    observationSignals: ['联系是否双向', '是否围绕可执行目标', '频率是否代替质量'],
  },
  {
    id: 'abc_x_stress',
    name: '双ABC-X家庭压力模型',
    ecosystemLayer: 'exo',
    applicableScenarios: ['经济压力', '父母易怒', '资源不足'],
    observationSignals: ['外部压力', '父母情绪变化', '夫妻冲突增多'],
  },
  {
    id: 'social_capital',
    name: '社会资本理论',
    ecosystemLayer: 'exo',
    applicableScenarios: ['社区支持弱', '隔代照料', '外部资源少'],
    observationSignals: ['家庭外支持网', '学校参与', '亲子关系质量'],
  },
  {
    id: 'sociocultural_scaffolding',
    name: '社会文化发展与脚手架',
    ecosystemLayer: 'exo',
    applicableScenarios: ['代劳作业', '超前要求', '辅导越界'],
    observationSignals: ['最近发展区', '脚手架还是代劳', '任务难度匹配'],
  },
  {
    id: 'dual_filial_piety',
    name: '双元孝道模型',
    ecosystemLayer: 'macro',
    applicableScenarios: ['为你好', '孝顺义务', '听话与体面'],
    observationSignals: ['权威服从脚本', '感恩互惠', '家族名誉压力'],
  },
  {
    id: 'ecological_systems',
    name: '生态系统理论',
    ecosystemLayer: 'macro',
    applicableScenarios: ['升学文化', '社会期待', '比较竞争'],
    observationSignals: ['文化脚本', '环境压力层', '跨系统影响'],
  },
  {
    id: 'stage_environment_fit',
    name: '阶段-环境匹配理论',
    ecosystemLayer: 'chrono',
    applicableScenarios: ['升学转折', '青春期', '转学搬家'],
    observationSignals: ['转折前后对比', '自主感变化', '评价方式变化'],
  },
  {
    id: 'family_life_cycle',
    name: '家庭生命周期理论',
    ecosystemLayer: 'chrono',
    applicableScenarios: ['学龄期任务', '青春期过渡', '家庭阶段压力'],
    observationSignals: ['阶段发展任务', '过渡压力', '角色重新协商'],
  },
  {
    id: 'erikson_stage',
    name: '心理社会发展理论',
    ecosystemLayer: 'chrono',
    applicableScenarios: ['勤勉自卑', '认同混乱', '年龄任务冲突'],
    observationSignals: ['阶段任务', '能力感', '角色认同线索'],
  },
]

export function theoryCardsForLayer(layer: EcosystemLayer): TheoryCard[] {
  return THEORY_CARDS.filter((c) => c.ecosystemLayer === layer)
}

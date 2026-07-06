import type { EcosystemLayer } from '@/types/database'

export type TheoryCard = {
  id: string
  name: string
  ecosystemLayer: EcosystemLayer
  applicableScenarios: string[]
  observationSignals: string[]
}

/** MVP 10 张核心理论卡（对齐家庭理论判断流程简版 §6） */
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
    id: 'abc_x_stress',
    name: '双ABC-X家庭压力模型',
    ecosystemLayer: 'exo',
    applicableScenarios: ['经济压力', '父母易怒', '资源不足'],
    observationSignals: ['外部压力', '父母情绪变化', '夫妻冲突增多'],
  },
  {
    id: 'dual_filial_piety',
    name: '双元孝道模型',
    ecosystemLayer: 'macro',
    applicableScenarios: ['为你好', '孝顺义务', '听话与体面'],
    observationSignals: ['权威服从脚本', '感恩互惠', '家族名誉压力'],
  },
  {
    id: 'stage_environment_fit',
    name: '阶段-环境匹配理论',
    ecosystemLayer: 'chrono',
    applicableScenarios: ['升学转折', '青春期', '转学搬家'],
    observationSignals: ['转折前后对比', '自主感变化', '评价方式变化'],
  },
]

export function theoryCardsForLayer(layer: EcosystemLayer): TheoryCard[] {
  return THEORY_CARDS.filter((c) => c.ecosystemLayer === layer)
}

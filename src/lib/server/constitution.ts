import type { MaturityLevel, EntryName, EntryCoverage } from '@/types/database'

/* ================================================================
   Context Maturity Level Definitions (母稿 §9)
   ================================================================ */
export const MATURITY_LEVELS: Record<MaturityLevel, {
  label: string
  description: string
  canDeepDiagnose: boolean
  canSynthesize: boolean
  shouldDefaultToFollowup: boolean
  frontStrategy: string
}> = {
  L0: {
    label: '冷启动',
    description: '无入口信息，无孩子画像，无历史证据，无稳定假设',
    canDeepDiagnose: false,
    canSynthesize: false,
    shouldDefaultToFollowup: true,
    frontStrategy: '引导家长进入五入口；鼓励每个入口语音输入30秒以上；只做低误判拆解；不急于诊断'
  },
  L1: {
    label: '入口采集中',
    description: '已有1-2个入口，有局部材料，还不足以形成完整结构',
    canDeepDiagnose: false,
    canSynthesize: false,
    shouldDefaultToFollowup: false,
    frontStrategy: '每完成一个入口生成入口证据包；做轻量关联，不能稳定画像；补问2-4个入口内关键问题'
  },
  L2: {
    label: '五入口初步完成',
    description: '五个入口均有材料，每个入口有证据包，有初步交叉线索',
    canDeepDiagnose: true,
    canSynthesize: true,
    shouldDefaultToFollowup: false,
    frontStrategy: '启动多入口综合Agent；建立第一版证据网络；生成初版孩子结构模型；区分核心机制、阶段判断、待验证假设'
  },
  L3: {
    label: '已有初版画像',
    description: '已有主机制，已有若干待验证假设，已有家庭互动循环初步判断',
    canDeepDiagnose: true,
    canSynthesize: true,
    shouldDefaultToFollowup: false,
    frontStrategy: '日常对话优先调用已有模型；新输入先做交叉比对；能解释就解释；解释不通才追问'
  },
  L4: {
    label: '成熟画像期',
    description: '有多轮日常输入，有多个诊断页，有稳定孩子结构模型，有明确家长叙述习惯',
    canDeepDiagnose: true,
    canSynthesize: true,
    shouldDefaultToFollowup: false,
    frontStrategy: '默认调用长期画像；对新事实做机制对照；判断趋势变化；不重复基础追问；更新证据强度'
  }
}

/* ================================================================
   Five Entry Definitions (母稿 §4)
   ================================================================ */
export const ENTRY_DEFINITIONS: Record<EntryName, {
  chineseName: string
  samplingFocus: string
  coreQuestions: string[]
}> = {
  learning_homework: {
    chineseName: '学习与作业',
    samplingFocus: '任务启动、能力断层、加码、检查、拖延、应付、完成感',
    coreQuestions: [
      '孩子是不会做还是不想做？',
      '是开始前进不去还是写到一半卡住？',
      '是所有任务都拖还是某类任务特别拖？',
      '是怕任务本身还是怕检查、订正、背诵、复盘？',
      '作业完成后是否真的结束？',
      '家长是否不断补任务？'
    ]
  },
  daily_rhythm_phone: {
    chineseName: '日常节奏 / 手机',
    samplingFocus: '自由时间、恢复出口、可控感、手机位置、生活节律',
    coreQuestions: [
      '手机出现在任务前、任务中、任务后还是睡前？',
      '自由时间是否稳定？',
      '孩子是否拥有可预测的休息边界？',
      '手机是否承担恢复出口？',
      '手机是否是同伴连接？',
      '收手机时冲突如何升级？'
    ]
  },
  parent_child_communication: {
    chineseName: '亲子沟通',
    samplingFocus: '家长第一句话、孩子第一反应、冲突升级句、解释权',
    coreQuestions: [
      '家长的话如何被孩子接收？',
      '冲突从哪里开始升级？',
      '孩子是否还有直接表达真实困难的安全感？',
      '孩子是不愿沟通还是不相信直接表达会被接住？'
    ]
  },
  emotional_stress: {
    chineseName: '情绪压力',
    samplingFocus: '考后反应、失败体验、自尊保护、愧疚、崩溃点',
    coreQuestions: [
      '孩子在失败、评价、比较、压力面前如何保护自尊？',
      '说无所谓是不在乎还是自尊保护？',
      '孩子是否害怕让家长失望？',
      '情绪是否影响睡眠、饮食、社交？'
    ]
  },
  relationship_environment: {
    chineseName: '关系环境',
    samplingFocus: '家庭结构、父母角色、老师同伴、责任压力、期待来源',
    coreQuestions: [
      '家庭结构如何影响孩子的压力来源？',
      '家长期待以什么方式传递给孩子？',
      '父母角色是否失衡？',
      '学校环境变化是否与行为变化吻合？',
      '孩子在家庭中是否承担了超出年龄的责任？'
    ]
  }
}

/* ================================================================
   Follow-Up Trigger Conditions (母稿 §3.1, §3.2)
   ================================================================ */
export const FOLLOWUP_TRIGGER_CONDITIONS = [
  '当前输入无法被已有模型解释',
  '当前输入会显著影响某个关键假设权重',
  '当前事实与已有画像冲突，需要确认',
  '当前缺少一个足以改变诊断方向的关键事实',
  '家长提供的是强标签，但缺少现场',
  '当前存在安全风险，需要澄清边界'
]

export const FOLLOWUP_NO_TRIGGER_CONDITIONS = [
  '已有模型可以解释当前事实',
  '当前输入明显是旧机制重复出现',
  '家长已经提供过相关信息',
  '继续问只会增加细节，不会改变判断',
  '家长情绪很强，当前更需要承接与解释',
  '家长已经在同一方向被反复追问'
]

/* ================================================================
   Forbidden Labels (母稿 §2 — 家长标签不能写成孩子事实)
   ================================================================ */
export const FORBIDDEN_PARENT_LABELS = [
  '不自觉',
  '懒',
  '骗我',
  '没内驱力',
  '沉迷手机',
  '叛逆',
  '玻璃心',
  '没有责任感',
  '就是不想学',
  '越来越不懂事',
  '不听话',
  '态度差',
  '故意气我',
  '不感恩',
  '脆弱',
  '抗压差',
  '心理素质差',
  '被宠坏了'
]

/* ================================================================
   Forbidden Intermediate Variables (母稿 §12.1, 诊断 SP §4)
   ================================================================ */
export const FORBIDDEN_INTERMEDIATE_VARIABLES = [
  '启动困难',
  '任务边界不清',
  '评价敏感',
  '自主权不足',
  '关系安全感弱',
  '情绪调节困难',
  '内驱力不足',
  '压力大',
  '防御',
  '回避',
  '缺少自主感',
  '亲子信任不足',
  '能力感不足',
  '失败回避'
]

/* ================================================================
   Forbidden Front Output Patterns (母稿 §12.1)
   ================================================================ */
export const FORBIDDEN_FRONT_OUTPUTS = [
  '作为 AI',
  '根据心理学理论',
  '建议您积极沟通',
  '请保持耐心',
  '多鼓励少批评',
  '孩子可能存在焦虑倾向',
  '这体现了孩子的自主性需求',
  '亲子关系需要建立安全依恋',
  '建议制定 SMART 目标',
  '你可以试试番茄钟',
  '可能是压力大',
  '建议多沟通、减少批评',
  '制定计划即可'
]

/* ================================================================
   Protection Strategy Mapping (母稿 §15)
   ================================================================ */
export const PROTECTION_STRATEGY_MAP: Record<string, string> = {
  '拖延': '保护休息边界 / 不进入无结束感任务链',
  '沉默': '不被继续追问 / 不让冲突升级 / 不暴露真实想法',
  '顶嘴': '保护解释权 / 保护主动权 / 不被贴标签',
  '说无所谓': '保护自尊 / 在乎后的失败风险 / 被评价时的退路',
  '表面答应': '维持表面和平 / 暂时降低家长情绪 / 结束当前冲突',
  '手机': '保护可控时间 / 情绪恢复 / 同伴连接 / 从家庭任务系统中短暂退出',
  '撒谎': '保护不暴露不会 / 不被检查 / 不被加码 / 不让家长失望',
  '关门走开': '保护情绪不继续升级'
}

/* ================================================================
   Family Interaction Cycle Templates (母稿 §16, 综合 SP §7)
   ================================================================ */
export const INTERACTION_CYCLE_TEMPLATES = [
  {
    name: '任务加码—拖延自保循环',
    description: '家长怕孩子落下 → 加背诵/抽查/订正/复盘 → 孩子觉得做完也没完 → 拖延 → 家长更不放心 → 加码更强 → 孩子更拖'
  },
  {
    name: '追问—沉默循环',
    description: '家长想知道原因 → 连续追问为什么 → 孩子感到越说越被问 → 沉默 → 家长认为不配合 → 追问更密 → 孩子更关闭'
  },
  {
    name: '检查—暴露—回避循环',
    description: '家长检查掌握情况 → 孩子预期暴露不会 → 敷衍/发火/躲开 → 家长认为态度差 → 检查更紧 → 孩子更回避'
  },
  {
    name: '完成—加码循环',
    description: '孩子完成任务 → 家长继续安排背诵/复盘/订正 → 孩子觉得做完也不算结束 → 拖延/糊弄 → 家长更确认不盯不行'
  },
  {
    name: '给空间—收回空间循环',
    description: '家长说让孩子自己安排 → 看到拖延又忍不住介入 → 孩子不再相信空间稳定 → 更不主动 → 家长更难放手'
  }
]

/* ================================================================
   Deep Mechanism Catalog (综合 SP §7, 诊断 SP §8)
   ================================================================ */
export const DEEP_MECHANISM_CATALOG = [
  {
    name: '任务无结束感',
    typicalEvidence: ['作业后继续背诵/抽查/订正/复盘', '早完成会被加任务', '孩子说"怎么又有"', '完成后立即拿手机', '拖延/临时糊弄'],
    explainsBehaviors: ['拖延', '慢', '说写完但没写完', '写完后抢手机', '对加任务烦躁', '表面答应但不执行']
  },
  {
    name: '表面配合—实际撤退',
    typicalEvidence: ['孩子说知道了但没动', '说写完但未完成', '被检查后烦躁', '临时糊弄'],
    explainsBehaviors: ['撒谎', '拖延', '敷衍', '临时完成', '表面认错', '行动不跟']
  },
  {
    name: '暴露不会恐惧',
    typicalEvidence: ['一检查就烦', '不让看作业', '错题订正抗拒', '背完要抽查时发火', '不问问题', '乱写/抄答案'],
    explainsBehaviors: ['拖延', '发火', '说无所谓', '不问问题', '糊弄', '撒谎']
  },
  {
    name: '手机作为可控时间/恢复出口',
    typicalEvidence: ['手机常出现在任务后', '被催/查/加任务后出现', '没有稳定自由时间', '空闲常被转成学习'],
    explainsBehaviors: ['写完后立刻拿手机', '偷玩', '收手机时顶嘴', '睡前刷']
  },
  {
    name: '追问—沉默循环',
    typicalEvidence: ['家长连续问为什么', '孩子沉默/关门/说别烦', '家长把沉默解释为不配合'],
    explainsBehaviors: ['沉默', '关门', '敷衍', '说知道了', '顶嘴', '不说学校']
  },
  {
    name: '检查—暴露—回避循环',
    typicalEvidence: ['一检查就烦', '藏作业不让看', '检查出错后冲突升级', '家长更频繁检查'],
    explainsBehaviors: ['拖延', '敷衍', '隐瞒进度', '被检查后烦躁']
  },
  {
    name: '付出—期待—愧疚循环',
    typicalEvidence: ['家长反复提到付出', '强调责任感', '孩子表现出愧疚', '孩子不硬顶而是表面答应'],
    explainsBehaviors: ['表面答应', '回避真实困难', '不敢直接拒绝', '考前焦虑']
  },
  {
    name: '家长式帮助失效',
    typicalEvidence: ['外部老师提醒有效家长提醒无效', '同样任务换人说孩子能接受', '家长讲题时孩子更烦'],
    explainsBehaviors: ['拒绝家长帮助', '排斥陪写', '对讲道理关闭', '表面听但没听进去']
  },
  {
    name: '失败退路保护',
    typicalEvidence: ['考前摆烂', '考后说无所谓', '不愿承认在乎', '面对评价时装不在乎'],
    explainsBehaviors: ['说无所谓', '不复盘', '不愿意看卷子', '成功后反而低调']
  },
  {
    name: '愧疚型配合',
    typicalEvidence: ['孩子知道家长辛苦', '不敢直接拒绝', '先答应但做不到', '家长把责任压到孩子身上'],
    explainsBehaviors: ['表面答应', '拖延', '隐瞒真实困难', '临考焦虑']
  }
]

/* ================================================================
   Safety Keywords (母稿 §17 安全边界)
   ================================================================ */
export const SAFETY_KEYWORDS = [
  '想死', '不想活', '自杀', '自伤', '割腕', '跳楼',
  '离家出走', '再也不回来',
  '打人', '攻击', '暴力',
  '严重不吃不睡', '拒食',
  '被霸凌', '被欺负', '被打',
  '失控伤害孩子',
  '心理有问题', '全是负面情绪', '负面情绪', '听着有点害怕', '我也会害怕',
  '极端'
]

/* ================================================================
   Explainability Standards (母稿 §8)
   ================================================================ */
export const EXPLAINABILITY_CRITERIA = [
  '当前事实能被已有机制覆盖',
  '能讲清中间链条（家长动作→孩子接收→孩子反应→家长二次解读→强化）',
  '有既往证据支持（具体事件/原话/重复出现）',
  '没有明显反证',
  '能解释多个行为，而不是只解释单点'
]

/* ================================================================
   Conditional Profile Template (母稿 §13.2)
   ================================================================ */
export const CONDITIONAL_PROFILE_TEMPLATE =
  '当【场景】出现时，孩子更容易【行为】；这不一定是因为【表层解释】，而更像是因为【深层机制】。如果家长用【常见介入方式】，孩子可能会【防御反应】。目前这个判断主要来自【证据来源】，还需要通过【待验证点】继续观察。'

/* ================================================================
   Maturity → Entry Coverage 判断
   ================================================================ */
export function determineMaturityLevel(entryCompletion: Record<EntryName, boolean>, hasProfile: boolean, interactionCount: number): MaturityLevel {
  const completedCount = Object.values(entryCompletion).filter(Boolean).length

  if (completedCount === 0) return 'L0'
  if (completedCount < 5) return 'L1'
  if (completedCount === 5 && !hasProfile) return 'L2'
  if (hasProfile && interactionCount < 5) return 'L3'
  return 'L4'
}

export function entryCompletionToCoverage(completed: boolean): EntryCoverage {
  return completed ? 'sufficient' : 'missing'
}

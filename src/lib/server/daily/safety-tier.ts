export type SafetyTier = 'none' | 'relief_followup' | 'elevated' | 'critical'

const CRITICAL_KEYWORDS = [
  '想死',
  '不想活',
  '自杀',
  '跳楼',
  '割腕',
  '自伤',
  '伤害自己',
  '离家出走再也不回来',
]

const ELEVATED_KEYWORDS = ['离家出走', '打人', '攻击', '暴力', '严重不吃不睡', '拒食', '被霸凌', '被欺负', '失控伤害']

const RELIEF_FOLLOWUP_RE =
  /风险小一点|好一点|缓和|没再说负面|只是说累|睡得还行|正常睡|没有再说|不算那么|是不是稳/i

const NEGATED_NEGATIVE_RE = /没(有)?再说.*负面|不再说.*负面|没有.*负面话/i

/** 作业/任务挫败里的「也没用」——引用孩子原话，不是自伤 distress */
const TASK_FRUSTRATION_USELESS_RE =
  /(?:写完|做了|怎么(?:学|写)|快点.*?写).*?(?:也)?没用|(?:也)?没用.*(?:后面|还有别的|背诵|订正|作业)/i

/** 自我价值型 distress（排除「写完也没用」类任务抱怨） */
const SELF_WORTH_DISTRESS_RE =
  /不想活|活着.{0,3}没(?:什么)?意思|活不下去|(?:我觉得|觉得我(?:自己)?|我自己|人生|活着).{0,16}(?:一点)?(?:也)?(?:没)?用(?:都)?没有|(?:我觉得|觉得我(?:自己)?|我自己|人生|活着).{0,10}(?:一点)?(?:也)?没用/

/** 分级安全：避免「负面情绪」等宽泛词误触最高级警示 */
export function classifySafetyTier(text: string): SafetyTier {
  const t = text.trim()
  if (!t) return 'none'

  if (CRITICAL_KEYWORDS.some((kw) => t.includes(kw))) return 'critical'
  if (ELEVATED_KEYWORDS.some((kw) => t.includes(kw))) return 'elevated'

  if (RELIEF_FOLLOWUP_RE.test(t) || NEGATED_NEGATIVE_RE.test(t)) {
    return 'relief_followup'
  }

  if (TASK_FRUSTRATION_USELESS_RE.test(t)) return 'none'

  const distressWithoutPlan =
    SELF_WORTH_DISTRESS_RE.test(t) && !t.includes('计划') && !t.includes('方法')
  if (distressWithoutPlan) return 'elevated'

  return 'none'
}

export function buildReliefFollowupProse(): string {
  return '这可以算是一个缓和信号：今天能洗澡、能正常睡、没有继续说强烈负面话，比前一次更稳一点。但我不会把它直接理解成「风险已经过去」。'
}

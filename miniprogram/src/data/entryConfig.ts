import { BUILD_ENTRY_ORDER, isBuildEntryType, normalizeBuildEntryType, type BuildEntryType } from '@/lib/buildEntries'

export type EntryType = BuildEntryType

export type EntryModuleConfig = {
  type: BuildEntryType
  title: string
  stepLabel: string
  prompt: string
  subtitle: string
  body: string
  hubDesc: string
  defaultHint: string
  chips: string[]
  placeholder: string
  prompts: string[]
  summaryTitle: string
  confirm: string
}

/** 对齐 xubaoyue7577-sudo/pages 四模块（1 日常 2 作业 3 沟通 4 家庭） */
export const entryConfigs: EntryModuleConfig[] = [
  {
    type: 'daily',
    title: '孩子每天的时间安排',
    stepLabel: '1/4',
    prompt: '请从放学到睡前，按顺序说说通常发生什么',
    subtitle: '请说清放学、吃饭、作业、手机、休息和睡觉大概怎么安排。',
    body: '从一个普通工作日讲起：孩子几点回家，先做什么，作业和手机分别在什么时候，一般几点睡。',
    hubDesc: '放学到睡前，通常怎么安排',
    defaultHint: '',
    chips: [],
    placeholder:
      '例如：放学回家先吃饭\n然后说休息一会儿\n拿起手机就很难放下\n晚上作业拖到很晚',
    prompts: [
      '可以从一个普通的一天开始讲，顺着说到晚上睡前，看看孩子一天里真正能自己支配的时间有多少。',
      '可以补充一周里哪里最紧、哪里能休息，尤其是手机、出门和放松大概怎么排。',
      '如果孩子有特别放松或特别烦的时间段，也可以顺着讲一讲那时候通常发生了什么。',
      '可以顺带讲讲晚上一般几点睡，早上起床费不费劲，这会影响后面判断他是不是已经很疲惫。',
    ],
    summaryTitle: '孩子的日常节奏整理好了',
    confirm: '下面是根据你刚才讲的内容整理的，看看是否大体接近。',
  },
  {
    type: 'homework',
    title: '写作业的经过',
    stepLabel: '2/4',
    prompt: '请讲一件最近写作业时，从开始到结束发生的事',
    subtitle: '请说清什么时候开始、谁先开口、孩子怎么回应、最后怎么收场。',
    body: '从一次最近作业讲起：孩子什么时候该开始，你怎么提醒，他怎么回应，后来写没写完、有没有争吵。',
    hubDesc: '一次作业从开始到结束发生了什么',
    defaultHint: '',
    chips: [],
    placeholder:
      '例如：他一回家就说要休息\n我催他写作业 他说知道了\n半小时后还是没动\n后来我坐在旁边他才动笔',
    prompts: [
      '可以顺着一次最近的作业经历继续讲：他什么时候开始拖，你第一次怎么提醒，他怎么回，后来怎么升级。',
      '可以把「开始前、开始后、检查、收尾」这几个阶段连起来讲一遍，看看最容易卡在哪一步。',
      '可以再讲讲最后怎么收场：是写完了、拖到很晚、吵完才写，还是最后不了了之。',
      '可以补一段你当时怎么推进这件事：第一次提醒、第二次催、后来有没有坐在旁边看着。',
    ],
    summaryTitle: '作业流程整理好了',
    confirm: '下面是根据你刚才讲的内容整理的，看看是否大体接近。',
  },
  {
    type: 'communication',
    title: '亲子沟通习惯',
    stepLabel: '3/4',
    prompt: '请复述一次最近的亲子对话，尽量按当时的话说',
    subtitle: '请说清你先说什么、孩子怎么回、后来有没有升级或冷下来。',
    body: '选一次最近的对话：你先说了什么，孩子怎么回，你下一句又怎么接，最后怎样结束。',
    hubDesc: '复述一次最近的亲子对话',
    defaultHint: '',
    chips: [],
    placeholder:
      '例如：我说你怎么又没开始写\n他说我知道了\n然后就不说话\n我又问了几句 他开始烦',
    prompts: [
      '可以把最像真实吵起来的那一小段复述一下：你先说了什么，他怎么顶回来，你下一句又怎么接。',
      '可以继续讲讲他生气时通常是什么样：顶嘴、沉默、哭、关门、讲条件，还是故意拖着不回应。',
      '可以补一段吵完之后的状态：他会很快缓下来，还是继续冷着，你们通常怎么重新说话。',
      '如果记得，可以尽量按当时的语气复述几句。沟通预演会参考这些原话，而不是生成一个很配合的孩子。',
    ],
    summaryTitle: '沟通场景整理好了',
    confirm: '下面是根据你刚才讲的内容整理的，看看是否大体接近。',
  },
  {
    type: 'family',
    title: '家里的日常习惯',
    stepLabel: '4/4',
    prompt: '请说说家里平时谁陪、谁提醒、规则怎么执行',
    subtitle: '请讲清大人怎么分工、意见是否一致、以前试过哪些办法。',
    body: '说说家里谁主要陪学习、谁提醒和检查，遇到分歧时怎么处理，哪些办法有用或没用。',
    hubDesc: '家里谁做什么，平时怎么配合',
    defaultHint: '',
    chips: [],
    placeholder:
      '例如：学习主要是我管\n爸爸偶尔会说一下\n奶奶有时会护着他\n我们试过陪写 有用一点 但很累',
    prompts: [
      '可以顺着作业这件事讲讲家里的分工：谁先提醒、谁盯过程、谁检查、谁最后收尾。',
      '可以补充一段家里大人意见不一致的时候，孩子通常会怎么反应。',
      '可以讲讲以前试过哪些办法：哪些稍微有用一点，哪些反而让孩子更抗拒。',
      '可以补一段你现实里能投入多少时间和精力，这会影响后面的建议能不能真正执行。',
    ],
    summaryTitle: '家庭支持方式整理好了',
    confirm: '下面是根据你刚才讲的内容整理的，看看是否大体接近。',
  },
]

export function getEntryConfig(type: EntryType | BuildEntryType | string) {
  const key = normalizeBuildEntryType(String(type)) ?? (isBuildEntryType(String(type)) ? (String(type) as BuildEntryType) : null)
  return entryConfigs.find((c) => c.type === key) || entryConfigs[0]
}

export function getEntryConfigByBuildType(type: BuildEntryType) {
  return entryConfigs.find((c) => c.type === type) || entryConfigs[0]
}

export function isEntryCaptureUsable(text: string): boolean {
  const t = text.trim()
  if (t.length >= 70) return true
  const sceneWords = [
    '有一次', '昨天', '晚上', '放学', '作业', '手机', '提醒', '他说', '我说', '后来', '最后', '吵', '检查',
    '考', '哭', '烦', '爸爸', '妈妈', '同学', '老师',
  ]
  const hit = sceneWords.filter((w) => t.includes(w)).length
  return t.length >= 45 && hit >= 3
}

export const BUILD_ENTRY_COUNT = BUILD_ENTRY_ORDER.length

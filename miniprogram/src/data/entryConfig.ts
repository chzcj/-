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
    title: '孩子平时怎么过',
    stepLabel: '1/4',
    prompt: '孩子平时怎么过',
    subtitle:
      '先讲讲孩子一天和一周的真实节奏。后面分析作业、手机、情绪和沟通时，会先看孩子是不是已经很累、有没有自己的时间、一天里哪里最容易紧。',
    body: '请你像聊天一样说说孩子平时怎么过。可以从一个普通的一天讲起：放学或回家后先做什么、什么时候写作业、什么时候玩手机，一周里哪里比较紧、哪里能放松。',
    hubDesc: '一天和一周大概怎么过',
    defaultHint: '不用评价孩子自不自觉，尽量讲真实安排。',
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
    title: '学习和作业怎么进行',
    stepLabel: '2/4',
    prompt: '学习和作业怎么进行',
    subtitle:
      '重点讲作业从「准备开始」到「最后结束」的真实过程。后面建议不会泛泛说少催促，而是会根据你们家具体卡住的地方来判断。',
    body: '请你讲讲孩子写作业通常怎么开始、怎么拖住、谁会介入、最后一般怎么结束。可以讲一件最近发生的事，也可以讲平时大概的流程。',
    hubDesc: '作业从准备到收场，真实过程讲一遍',
    defaultHint: '不用先总结孩子懒不懒，尽量把作业过程说出来。',
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
    title: '你们通常怎么沟通',
    stepLabel: '3/4',
    prompt: '你们通常怎么沟通',
    subtitle:
      '这一页会帮助沟通预演更像真实孩子。重点不是判断谁对谁错，而是听你们平时怎么开口、怎么升级、孩子通常怎么接。',
    body: '请你讲一次最近比较典型的对话。尽量复述你们当时怎么说，不用说得很完整，越接近原话越有用。比如你先说了什么，孩子怎么回，你下一句又怎么接，最后这段对话怎么结束。',
    hubDesc: '一次典型对话，尽量按原话复述',
    defaultHint: '尽量说原话，不用整理成道理。',
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
    title: '家里怎么一起支持他',
    stepLabel: '4/4',
    prompt: '家里怎么一起支持他',
    subtitle:
      '不是评价家长做得好不好，而是了解孩子面对的是怎样的家庭安排：谁提醒，谁检查，谁定规则，谁在最后收尾。',
    body: '请你讲讲家里平时怎么陪孩子。包括谁主要管学习，谁提醒，谁检查，爸爸妈妈或老人看法是否一致，以前试过哪些办法，哪些有用一点，哪些反而更糟。',
    hubDesc: '家里谁管什么，规则怎么落地',
    defaultHint: '不用替家里任何人下结论，讲平时实际怎么做就可以。',
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

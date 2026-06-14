import type { EntryType } from '@/types/storage'

export const entryConfigs: Array<{
  type: EntryType
  title: string
  stepLabel: string
  prompt: string
  helper: string
  chips: string[]
  placeholder: string
}> = [
  {
    type: 'study',
    title: '学习与作业',
    stepLabel: '1/5',
    prompt: '讲一个最近的作业场景',
    helper: '孩子什么时候开始拖 你怎么提醒 他怎么回',
    chips: ['哪科最卡', '你怎么提醒', '孩子怎么回'],
    placeholder: '例如：最近数学作业总拖\n我一提醒他 他就说知道了\n但半小时后还是没动',
  },
  {
    type: 'routine',
    title: '日常节奏',
    stepLabel: '2/5',
    prompt: '讲讲孩子放学后通常怎么过',
    helper: '手机一般出现在什么时候 刚回家 写作业前 写到一半 做完以后 还是睡前',
    chips: ['放学后', '写作业前', '做完以后', '睡前'],
    placeholder: '例如：他回家先吃饭\n然后说休息一会儿\n拿起手机就很难放下\n催他写作业 他会说等一下',
  },
  {
    type: 'communication',
    title: '亲子沟通',
    stepLabel: '3/5',
    prompt: '复述一段最近卡住的对话',
    helper: '你第一句怎么说 孩子第一句怎么回 最后是继续聊 沉默 顶嘴 还是走开',
    chips: ['你怎么说', '孩子怎么回', '哪里卡住'],
    placeholder: '例如：我说你怎么又没开始写\n他说我知道了\n然后就不说话\n我又问了几句 他开始烦',
  },
  {
    type: 'emotion',
    title: '情绪压力',
    stepLabel: '4/5',
    prompt: '讲一个孩子最近情绪波动明显的场景',
    helper: '考差 被批评 和同学闹矛盾之后 他会怎么反应 多久能缓过来',
    chips: ['考差后', '被批评后', '多久缓过来'],
    placeholder: '例如：上次数学没考好\n他回家后不太说话\n我问他怎么回事\n他说没什么\n后来整晚都不太想聊',
  },
  {
    type: 'environment',
    title: '关系环境',
    stepLabel: '5/5',
    prompt: '讲讲孩子在家里 同伴 老师面前分别是什么状态',
    helper: '谁对他影响最大 他在哪类关系里最放松 在哪类关系里最紧绷',
    chips: ['家里', '同伴', '老师', '谁影响最大'],
    placeholder: '例如：他在老师面前比较老实\n在同学面前话多一些\n但在家一说学习就容易烦\n我感觉他最在意老师评价',
  },
]

export function getEntryConfig(type: EntryType) {
  return entryConfigs.find((c) => c.type === type) || entryConfigs[0]
}

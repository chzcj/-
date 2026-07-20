export type RehearsalScene = {
  id: string
  title: string
  subtitle: string
  lede?: string
  mentionCountHint?: string
  summary: string
  placeholder: string
  seed: string
  openingChild?: string
  openingHintTitle?: string
  openingHint?: string
}

export const REHEARSAL_SCENES: RehearsalScene[] = [
  {
    id: 'homework_start',
    title: '写作业前怎么开口',
    subtitle: '他拖着不开始，你一催就容易吵起来。',
    summary: '今晚 7:40，孩子已经拖了快一小时。你提醒过两次，他开始烦。你担心再拖到很晚，想让他开始写作业。',
    placeholder: '描述一下你想练的场景。例如：今晚作业拖了很久，我想让他开始写，但一说就吵。',
    seed: '写作业前怎么开口',
    openingChild: '你别催我行不行，我又不是不写。',
    openingHintTitle: '他可能是这样听到的',
    openingHint:
      '他现在不一定是在认真回答“什么时候写”，更像是在把你推开。对他来说，“你催我”可能意味着后面又要开始被盯、被改、被评价。',
  },
  {
    id: 'after_conflict',
    title: '刚吵完怎么修复',
    subtitle: '刚才说重了，想重新开口，但怕越说越糟。',
    summary: '刚才你们已经吵过一轮，你想重新开口，但担心一说又让他更烦。',
    placeholder: '例如：刚才我们吵了一架，现在气氛很僵，我想缓和一下……',
    seed: '刚吵完怎么修复',
    openingChild: '你别说了，我不想听。',
    openingHintTitle: '他还在防御里',
    openingHint: '刚吵完时，他更需要先感到“对话不会马上变成批评”，而不是立刻听到你的道理或安排。',
  },
  {
    id: 'phone',
    title: '手机规则怎么谈',
    subtitle: '一提手机就炸，想谈规则，又不想变成争吵。',
    summary: '一提手机规则，孩子就容易炸。你想谈边界，但不想又变成争吵。',
    placeholder: '例如：说好再看十分钟，怎么又超时了……',
    seed: '手机规则怎么谈',
    openingChild: '就再看一会儿嘛，你每次都这样。',
    openingHintTitle: '规则感先于内容',
    openingHint: '他可能先听到的是“你又要收走我的东西”，而不是“我们在谈一个公平的约定”。',
  },
]

export function getRehearsalScene(id: string) {
  return REHEARSAL_SCENES.find((s) => s.id === id) || REHEARSAL_SCENES[0]
}

/** @deprecated 自定义场景已下线；保留 id 兼容旧 seed，映射到首个固定场景 */
export const CUSTOM_SCENE = {
  id: 'custom',
  title: '根据真实对话预演',
  subtitle: '',
  summary: REHEARSAL_SCENES[0]?.summary || '',
  placeholder: '',
  seed: '',
} as RehearsalScene

export type SimulationStep = 'entry' | 'confirm' | 'active' | 'end'

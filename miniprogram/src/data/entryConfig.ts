import { BUILD_ENTRY_ORDER, isBuildEntryType, normalizeBuildEntryType, type BuildEntryType } from '@/lib/buildEntries'

export type EntryType = BuildEntryType

export type EntryModuleConfig = {
  type: BuildEntryType
  title: string
  stepLabel: string
  /** capture 页顶部：一句人话说明要讲什么 */
  captureLead: string
  /** capture 页顶部：客观要点（逐条展示，不轮换） */
  capturePoints: string[]
  /** 采集页：鼓励写细（300 字 / 按住约 1 分钟） */
  captureVolumeHint: string
  /** 追问页预设池：按轮次轮换；AI 定制句优先 */
  followUpPrompts: string[]
  hubDesc: string
  defaultHint: string
  placeholder: string
  summaryTitle: string
  confirm: string
}

const CAPTURE_VOLUME_HINT =
  '尽量写细：打字建议 300 字以上；按住说话可以说满约 1 分钟。原话、时间点、孩子怎么回都可以讲。'

export const entryConfigs: EntryModuleConfig[] = [
  {
    type: 'daily',
    title: '孩子每天的时间安排',
    stepLabel: '1/4',
    captureLead: '说说孩子平常一个上学日：从放学到睡觉，按时间往下讲就行。',
    capturePoints: [
      '几点到家？到家后先做什么？',
      '作业大概几点开始、写到几点？',
      '手机能玩多久、谁管？',
      '几点睡、几点起？',
    ],
    captureVolumeHint: CAPTURE_VOLUME_HINT,
    followUpPrompts: [
      '想弄清的是：放学到家，到你说「该写作业了」这段，他一般先干嘛、拖多久？手机是这时玩，还是睡前才玩？',
      '想弄清的是：上学日几点睡、几点起？周末能差多少——是起得晚，还是睡得也晚？',
      '想弄清的是：一周里哪几天最赶、哪几天相对松？主要是补课多、作业多，还是别的事？',
      '想弄清的是：有没有一段真正属于他的时间——不被临时加任务、也不被催？大概在什么时候？',
      '想弄清的是：吃饭、洗澡、休息这些，时间固定吗？经常拖的话，拖的时候通常在干嘛？',
      '想弄清的是：手机谁管、几点收？他配合吗？不配合时你怎么说、他怎么回？',
      '想弄清的是：周末和上学日比，节奏差在哪——起得晚、玩得久，还是作业堆一块？',
      '想弄清的是：你开口催他动身（写作业、洗澡、睡觉）前，他通常在做什么？你第一句怎么说？',
    ],
    hubDesc: '放学到睡前，通常怎么安排',
    defaultHint: '只讲实际安排，不用评价孩子乖不乖。',
    placeholder:
      '17:30 到家，先吃饭\n' +
      '18:30—19:30 说休息，其实在玩手机\n' +
      '20:00 开始写作业，常拖到 22:30\n' +
      '23:00 睡，7:00 起',
    summaryTitle: '孩子的日常节奏整理好了',
    confirm: '下面是根据你刚才讲的内容整理的，看看是否大体接近。',
  },
  {
    type: 'homework',
    title: '写作业的经过',
    stepLabel: '2/4',
    captureLead: '讲一次最近写作业：从「该写了」到「写完或收场」。',
    capturePoints: [
      '几点该写？孩子当时在干嘛？',
      '你第一次怎么催？孩子原话怎么回？',
      '写的时候谁在场、会不会盯着检查？',
      '最后几点结束？有没有吵？',
    ],
    captureVolumeHint: CAPTURE_VOLUME_HINT,
    followUpPrompts: [
      '想弄清的是：他更烦「还没动笔」那段，还是「写到一半、被你检查」那段？',
      '想弄清的是：你第一次催那句原话怎么说？他原话怎么回？',
      '想弄清的是：写完以后能收工吗？还是还会加任务、再检查一遍？',
      '想弄清的是：写的时候谁在场？你会坐旁边盯着，还是过一会儿来看一眼？',
      '想弄清的是：他说休息、喝水、找本子——这类借口一般拖多久？你会等还是接着催？',
      '想弄清的是：题目难或写错时，他什么反应？你会怎么说、他会怎么回？',
      '想弄清的是：从「该写了」到真正动笔，中间通常隔多久？这时间里发生了什么？',
      '想弄清的是：最后一次收场——几点结束、有没有吵、当晚还聊作业吗？',
    ],
    hubDesc: '一次作业从开始到结束发生了什么',
    defaultHint: '只讲过程，别说孩子懒不懒。',
    placeholder:
      '18:00 该写，孩子说要先休息\n' +
      '18:30 我说「快去写」，他说「知道了」\n' +
      '19:00 还没动，我坐旁边看着\n' +
      '22:40 写完，中间 19:30 吵过一次',
    summaryTitle: '作业流程整理好了',
    confirm: '下面是根据你刚才讲的内容整理的，看看是否大体接近。',
  },
  {
    type: 'communication',
    title: '亲子沟通习惯',
    stepLabel: '3/4',
    captureLead: '把最近一次对话讲出来，你当时怎么说就怎么写。',
    capturePoints: [
      '你第一句说啥、孩子怎么回？',
      '后面至少再来两轮。',
      '最后怎么结束——继续了、沉默了，还是回房间了？',
    ],
    captureVolumeHint: CAPTURE_VOLUME_HINT,
    followUpPrompts: [
      '想弄清的是：典型一次，从谁先开口，到哪一句之后他开始顶嘴、沉默或关门？',
      '想弄清的是：他开始躲或顶之前，你最后一句原话是什么？他怎么回的？',
      '想弄清的是：吵完或冷场后，当晚还说话吗？第二天怎么收场？',
      '想弄清的是：同样的事，换一天、换时间问，他的反应会不一样吗？',
      '想弄清的是：顶嘴、敷衍「知道了」、干脆不回——哪种最常见？各举一句原话。',
      '想弄清的是：聊吃饭、出门、手机这些时，语气会和聊学习时不一样吗？',
      '想弄清的是：你情绪上来时通常会说哪句？说完他一般什么反应？',
      '想弄清的是：有没有哪句话一出口他就关门或走开的？你还记得原话吗？',
    ],
    hubDesc: '复述一次最近的亲子对话',
    defaultHint: '尽量写原话，不用整理成道理。',
    placeholder:
      '我：「你怎么又没开始写？」\n' +
      '孩子：「我知道了。」\n' +
      '我：「都七点半了。」\n' +
      '孩子：「别催了。」\n' +
      '（后来回房间，当晚没再说话）',
    summaryTitle: '沟通场景整理好了',
    confirm: '下面是根据你刚才讲的内容整理的，看看是否大体接近。',
  },
  {
    type: 'family',
    title: '家里的日常习惯',
    stepLabel: '4/4',
    captureLead: '说说家里谁管学习、规矩怎么定、以前试过什么。',
    capturePoints: [
      '谁提醒、谁陪写、谁检查？',
      '大人意见不一致时怎么办？',
      '试过哪些办法，哪个有点用、哪个更糟？',
      '你一天大概能花多少时间在盯学习上？',
    ],
    captureVolumeHint: CAPTURE_VOLUME_HINT,
    followUpPrompts: [
      '想弄清的是：学习、手机、情绪主要谁管？另一人通常什么态度？',
      '想弄清的是：大人意见不一致时，孩子站哪边，还是会钻空子？',
      '想弄清的是：以前试过哪些办法？哪个有点用、哪个反而更糟？',
      '想弄清的是：你一天大概花多少时间在盯学习上？最累的是哪一段？',
      '想弄清的是：几点睡、手机、作业这些规矩谁定、谁执行？孩子知道找谁商量吗？',
      '想弄清的是：爷爷奶奶或其他长辈在时，规则会变吗？孩子会不会趁机多玩一会？',
      '想弄清的是：你和另一半（或主要带娃的人）最容易在哪件事上拧着？孩子通常怎么应对？',
      '想弄清的是：你最想改的一件事是什么？以前试过但没能坚持的是哪一步？',
    ],
    hubDesc: '家里谁做什么，平时怎么配合',
    defaultHint: '只讲家里实际怎么做，别评谁对谁错。',
    placeholder:
      '学习主要我管，爸爸偶尔说两句\n' +
      '奶奶有时会护孩子\n' +
      '试过陪写，略有用但很累\n' +
      '收手机时孩子反应很大\n' +
      '工作日大概 1.5 小时盯作业',
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

export { isEntryCaptureUsable, ENTRY_CAPTURE_RELEASE_CHARS as ENTRY_CAPTURE_SUGGEST_CHARS } from '@/lib/entryInputQuality'

export const BUILD_ENTRY_COUNT = BUILD_ENTRY_ORDER.length

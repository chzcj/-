export const mockStudyFollowUp = {
  shouldAsk: true,
  purpose: '分清他是在躲不会做，还是在躲做完后继续加任务',
  directions: ['怕做不会', '做完没完', '被催更烦', '争取休息'],
  voicePrompt: '讲一个作业做完后又被加任务的场景。原本说好做什么，后来有没有增加，孩子当时怎么反应',
}

export const mockStudyStageSummary = {
  entryType: 'study',
  mainJudgment:
    '目前先不把孩子定成不自觉。更值得继续看的，是他是不是已经慢慢觉得：学习任务做完也不一定真的结束。对他来说，开始写作业不只是开始学习，也像是在进入一套可能被继续加任务、被检查、被追问的流程。所以他才会嘴上先答应，行动却拖着，被提醒后还容易烦。',
  facts: ['嘴上会答应，但行动经常拖', '被提醒后容易烦', '可能担心做完后还有新任务'],
  pendingHypotheses: ['孩子可能在用拖延争取一点喘息时间', '学习任务可能已经和被检查、被加码联系在一起'],
  note: '如果后面几类信息也支持，这个问题就不能只看成拖延，还要继续看孩子是不是已经在用拖延给自己争一点喘息时间。',
}

export const mockRoutineFollowUp = {
  shouldAsk: true,
  purpose: '分清手机是在放松恢复，还是在躲开马上进入学习',
  directions: ['休息一下', '躲开任务', '同伴连接', '停不下来'],
  voicePrompt: '讲一个孩子刚放学或写作业前拿起手机的场景。前面发生了什么，您怎么提醒，他怎么反应',
}

export const mockRoutineStageSummary = {
  entryType: 'routine',
  mainJudgment:
    '现在先不把手机简单看成沉迷。更值得看的是，手机是不是经常出现在学习开始前后，或者一提到学习任务时。这样的话，手机不只是娱乐，更可能是在帮孩子把自己从压力里临时抽出来。',
  facts: ['手机常出现在放学后或写作业前', '被催促放下手机时容易拖延', '手机可能承担休息和逃避双重作用'],
  pendingHypotheses: ['手机可能是孩子争取控制感的方式', '手机问题可能和学习启动压力互相绑定'],
  note: '后续要看的是：没有学习压力时，手机是否也明显失控。如果只在学习前后更明显，就不能简单按沉迷处理。',
}

export const mockCommunicationFollowUp = {
  shouldAsk: true,
  purpose: '分清孩子听到的是提醒，还是已经先听成评价和不信任',
  directions: ['听成提醒', '听成否定', '听成追问', '听成不信任'],
  voicePrompt: '请尽量复述一次最近的原话。您第一句怎么说，孩子第一句怎么回，哪里开始卡住',
}

export const mockCommunicationStageSummary = {
  entryType: 'communication',
  mainJudgment:
    '现在最值得注意的，不是孩子不愿意沟通，而是他可能已经判断：只要一解释，后面就会继续被追问、被复盘、被纠正。所以他会先用知道了、沉默、烦躁来把对话压下去。',
  facts: ['家长一提醒，孩子先说知道了', '继续追问后孩子容易烦', '对话经常从提醒变成争执'],
  pendingHypotheses: ['孩子可能不相信解释会被接住', '亲子沟通可能已经形成提醒—防御循环'],
  note: '这不是说家长不能提醒，而是要继续看：提醒在孩子那里到底被听成了帮助，还是被听成了又一次不信任。',
}

export const mockEmotionFollowUp = {
  shouldAsk: true,
  purpose: '分清他是当下烦一下，还是受挫后会持续关闭沟通',
  directions: ['当下防御', '持续回避', '怕被追问', '装作没事'],
  voicePrompt: '讲一个孩子最近受挫后的晚上。那天发生了什么，他回家后是继续说、变安静，还是不想再聊',
}

export const mockEmotionStageSummary = {
  entryType: 'emotion',
  mainJudgment:
    '孩子受挫后如果第一反应是没事、无所谓、沉默，不一定是真的不在乎。更可能是他已经习惯先把在意藏起来，避免后面继续被追问原因、复盘过程，或者再次暴露自己没做到。',
  facts: ['受挫后不太愿意展开说', '容易用没事或无所谓结束话题', '情绪恢复需要一段安静时间'],
  pendingHypotheses: ['孩子可能在保护自尊', '受挫场景可能和被追问、被评价绑定'],
  note: '后续要看的是：如果家长暂时不追问，孩子是否会在晚一点主动恢复表达。',
}

export const mockEnvironmentFollowUp = {
  shouldAsk: true,
  purpose: '分清孩子是在所有关系里都这样，还是主要在家里更容易进入防御',
  directions: ['只在家庭场景', '也出现在学校', '同伴面前不同', '谁的影响更大'],
  voicePrompt: '讲讲孩子在老师面前、同学面前分别是什么状态。有没有在哪类关系里更放松或者更紧绷',
}

export const mockEnvironmentStageSummary = {
  entryType: 'environment',
  mainJudgment:
    '孩子在不同关系里的状态如果差异很大，就说明问题不只是学习能力本身。尤其是如果他在学校还能维持基本任务，在家里却更容易拖、烦、关掉沟通，那么家庭场景里的压力接收方式就需要被认真看见。',
  facts: ['孩子在不同人面前反应不同', '家里谈学习时更容易紧张或烦', '老师和同伴可能影响孩子的自我感受'],
  pendingHypotheses: ['压力可能在家庭场景中被放大', '孩子在家里更容易进入防御状态'],
  note: '后续多视角补充会很有价值，因为它能帮系统区分：孩子是整体放弃，还是只在某些关系里更难打开。',
}

export function getMockFollowUp(entryType: string) {
  const map: Record<string, typeof mockStudyFollowUp> = {
    study: mockStudyFollowUp,
    routine: mockRoutineFollowUp,
    communication: mockCommunicationFollowUp,
    emotion: mockEmotionFollowUp,
    environment: mockEnvironmentFollowUp,
  }
  return map[entryType] || mockStudyFollowUp
}

export function getMockStageSummary(entryType: string) {
  const map: Record<string, typeof mockStudyStageSummary> = {
    study: mockStudyStageSummary,
    routine: mockRoutineStageSummary,
    communication: mockCommunicationStageSummary,
    emotion: mockEmotionStageSummary,
    environment: mockEnvironmentStageSummary,
  }
  return map[entryType] || mockStudyStageSummary
}

export const mockProfileSnapshot = {
  completeness: 72,
  coreJudgment:
    '目前最值得重视的，不是孩子单纯不自觉，而是他可能已经慢慢觉得：学习不是做完一项就结束，而是随时可能继续加码、被检查、被追问。对他来说，开始写作业不只是开始学习，也像是在进入一套很难真正结束的流程。所以他会嘴上先答应，行动上拖着，用拖延给自己争一点喘息时间。',
  deepMechanism:
    '这不是简单的拖延。孩子可能已经在学着应付您：先答应，把当下冲突压下去；再拖着，给自己争一点休息；如果继续被追问，就用烦躁、沉默或走开把对话结束。因为在他的感受里，学习任务常常不是做完就结束，而是后面还可能继续被加、被问、被检查。久了以后，他不会再相信直接说做不到会有用，只会越来越熟练地用拖延和敷衍保护自己。',
  supportFocus:
    '后续更该先处理的，不是继续加监督，而是让孩子重新相信：有些任务做完就真的结束，有些困难可以说出来，不会立刻变成新的压力。',
  evidence: [
    {
      sourceLabel: '学习与作业',
      evidenceText: '孩子嘴上会答应，但行动跟不上',
      explanation: '这说明他不是简单听不懂要求，而是答应和真正开始做已经分开了。',
      strength: 'strong' as const,
    },
    {
      sourceLabel: '学习与作业补充',
      evidenceText: '任务做完后还可能继续加内容',
      explanation: '这支持了孩子可能不再相信做完就能结束。',
      strength: 'strong' as const,
    },
    {
      sourceLabel: '亲子沟通',
      evidenceText: '一提醒他就烦，继续问会更不想说',
      explanation: '说明学习任务已经和被追问、被检查的感觉绑在一起。',
      strength: 'medium' as const,
    },
    {
      sourceLabel: '日常节奏',
      evidenceText: '手机常出现在学习开始前后',
      explanation: '如果手机总出现在学习前后，它就不只是娱乐，更可能是在争一点喘息和控制感。',
      strength: 'medium' as const,
    },
  ],
  verificationPoints: [
    {
      title: '孩子拖延的是所有任务，还是主要拖做完后还会继续加的任务',
      description: '如果主要拖后者，更支持他在用拖延保护自己的时间边界。',
    },
    {
      title: '当孩子先答应后拖着不做时，他是在争休息，还是已经默认直接说没用',
      description: '这能帮助系统区分短期拖延和长期应付策略。',
    },
    {
      title: '如果不追问、不加内容，孩子会不会更容易开始',
      description: '这能帮助分清是不会开始，还是主要在躲被催和被检查。',
    },
  ],
}

export const mockRehearsalResult = {
  headline: '孩子大概率不会先听成你在帮我，而会先听成你又来催我了。',
  explanation:
    '您原本是想把他拉回学习，但结合前面的画像，孩子更可能先接收到的是：他又做得不够，您已经不耐烦了，接下来还会继续盯他。所以他容易先进入防御，而不是进入任务。',
  childMayHear: ['你又觉得我不行', '现在就得按你说的做', '如果我做不好你会更失望'],
  stuckPoint:
    '问题不在于先写数学这句话本身，而在于前面已经有"别再拖了""你明明知道""还总是等我催"这些判断，孩子会先被评价感顶住。',
  suggestedWording:
    '我们先不说别的，就先定一件最小的事。你先写 20 分钟数学，我不追着问，也不临时再加内容。写完我们再看下一步。',
}

export const mockConflictReview = {
  headline: '这次冲突真正升级，不是从放下手机开始，而是从"你每次都这样"开始。',
  explanation:
    '孩子后面顶嘴，不是突然失控，而是他先听到了熟悉的判断：您已经认定他不会动、不会改、解释也没用。结合画像，他本来就容易把提醒听成检查和不信任，所以后面的争吵是在把这种无力感往外推。',
  escalationSentence: '你每次都说一会儿，作业一点没动。',
  childMayHear: '你又来了，你已经默认我就是不行，我现在说什么都没用。',
  suggestedReplacement:
    '我现在只盯一件事：手机先放下，5 分钟后我们一起看第一步做什么。我先不继续翻旧账。',
}

export const mockFinalFollowUp = {
  shouldAsk: true,
  purpose: '分清孩子是在躲学不会，还是已经不太相信做完就能结束',
  directions: ['学不会', '做完没完', '先答应再拖', '不敢直接说'],
  voicePrompt:
    '讲一个您原本说好任务结束，后来又追加内容的场景。孩子当时的表情、第一句话、后面有没有拖着不动',
}

export const mockDailyObservationInsight = {
  insight:
    '这条观察更支持之前的判断：孩子不是完全不动，而是一提到后面还要继续处理学习任务，就会先缩回去，给自己争一点缓冲。',
  linkedAreas: ['学习启动方式', '被提醒后的反应', '任务结束边界'],
  note: '这条会记进档案。后续如果类似片段继续出现，系统会把它和孩子的应付模式放在一起看。',
}

export const mockWeeklyReport = {
  headline: '这周最明显的，不是孩子更懒了，而是他一遇到可能又要被加内容就会先缩回去。',
  summary:
    '这一周的记录里，孩子在放学后、说到订正时、被提醒开始任务时，都出现了类似反应：先沉下去、先拖一会儿、先把话顶回去。它更像是在防御，不像单纯不用心。',
  repeatedPatterns: ['先答应再拖', '提到订正就皱眉', '不追问时会慢慢开始'],
  keyObservation:
    '一旦您不继续追问、不临时再加内容，孩子并不是完全不动，他会在安静一会儿后慢慢开始。',
  nextWatchPoints: ['不追加任务时，孩子开始是否更容易', '孩子拖的是订正补漏，还是所有学习任务'],
}

export const mockMultiViewCorrection = {
  headline: '家长看到的是拖，孩子感受到的是压，老师看到的却可能是并没有完全放弃。',
  summary:
    '三边的信息放在一起后，更能看出孩子不是单纯不用心。他在家里更容易防御，在老师面前更能维持基本任务，在自己的表达里又提到一想到后面还有很多东西就烦。这说明问题不只在学习，更在于压力是怎样被接收到的。',
  parentView: '看到的是拖延、答应了做不到、总要催。',
  childView: '不是完全不想写，是一想到后面还有很多东西就烦。',
  teacherView: '在学校并非完全不动，基本任务还能完成，只是主动性不高。',
  finalChips: ['家里更防御', '学校仍能维持', '怕做完没完'],
}

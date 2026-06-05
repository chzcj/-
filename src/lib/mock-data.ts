import type {
  A1Output,
  AdviceCardData,
  ArchiveDraft,
  ConversationStateData,
  RehearsalResultData,
  UnderstandingCardData
} from '@/types/childos';

export const firstPrompt = {
  question: '最近有没有一件让你有点挂心的小事，想先和我说说？',
  hint: '不用一下子说得很完整，先从你最在意的地方开始就好。也可以接着聊上次写作业有点费劲那件事。'
};

const prompts: Record<number, Omit<A1Output, 'familyId' | 'childId' | 'conversationId' | 'messageId'>> = {
  2: {
    schemaVersion: 'childos.a1.output.v1',
    ok: true,
    messageType: 'followup_question',
    scene: 'problem_solving',
    assistantMessage: {
      text: '我先理解一下，你更在意的好像不只是他玩手机，而是一提醒就容易进入不顺。',
      tone: 'calm'
    },
    highlightQuestion: {
      text: '这种情况一般是在开始写作业前，还是写到一半时更明显？',
      inputHint: '你先说说最常发生的那一次就好。'
    },
    progress: {
      currentRound: 2,
      minRound: 3,
      maxRound: 8,
      enoughForUnderstandingCard: false,
      shouldStopAsking: false
    },
    ui: {
      showReflectionCard: true,
      showQuestionCard: true,
      showQuickChoices: true,
      quickChoices: [
        { label: '开始前更明显', value: '开始前更明显' },
        { label: '写到一半更明显', value: '写到一半更明显' },
        { label: '两个都有', value: '两个都有' }
      ]
    },
    clientActions: { nextAction: 'continue_question', nextRoute: '/problem/follow-up' },
    safety: { riskLevel: 'none', needsHumanSupport: false, message: '' }
  },
  3: {
    schemaVersion: 'childos.a1.output.v1',
    ok: true,
    messageType: 'reflection_question',
    scene: 'problem_solving',
    assistantMessage: {
      text: '我先看到两个线索：一个是数学任务开始前有点压力，另一个是你一催，他更容易防御。',
      tone: 'warm'
    },
    highlightQuestion: {
      text: '你觉得更像哪一种：题目太难所以不想开始，还是一被催就更不想开始？',
      inputHint: '不用判断对错，说最像你家的那一点就好。'
    },
    progress: {
      currentRound: 3,
      minRound: 3,
      maxRound: 8,
      enoughForUnderstandingCard: false,
      shouldStopAsking: false
    },
    ui: {
      showReflectionCard: true,
      showQuestionCard: true,
      showQuickChoices: true,
      quickChoices: [
        { label: '题目太难', value: '题目太难' },
        { label: '一催就烦', value: '一催就烦' },
        { label: '两者都有', value: '两者都有' }
      ]
    },
    clientActions: { nextAction: 'continue_question', nextRoute: '/problem/follow-up' },
    safety: { riskLevel: 'none', needsHumanSupport: false, message: '' }
  },
  4: {
    schemaVersion: 'childos.a1.output.v1',
    ok: true,
    messageType: 'followup_question',
    scene: 'problem_solving',
    assistantMessage: {
      text: '这一步我想把“催促后发生了什么”还原得更清楚一点。',
      tone: 'calm'
    },
    highlightQuestion: {
      text: '最近一次发生时，你当时大概怎么提醒他的？',
      inputHint: '可以直接说原话，也可以说个大概。'
    },
    progress: {
      currentRound: 4,
      minRound: 3,
      maxRound: 8,
      enoughForUnderstandingCard: false,
      shouldStopAsking: false
    },
    ui: { showReflectionCard: true, showQuestionCard: true, showQuickChoices: false },
    clientActions: { nextAction: 'continue_question', nextRoute: '/problem/follow-up' },
    safety: { riskLevel: 'none', needsHumanSupport: false, message: '' }
  },
  5: {
    schemaVersion: 'childos.a1.output.v1',
    ok: true,
    messageType: 'followup_question',
    scene: 'problem_solving',
    assistantMessage: {
      text: '我听到这里，冲突像是从“没开始”变成了“你不相信我能开始”。',
      tone: 'calm'
    },
    highlightQuestion: {
      text: '他听到你提醒以后，通常第一反应是什么？',
      inputHint: '比如顶嘴、沉默、拖着不动，或者表面答应。'
    },
    progress: {
      currentRound: 5,
      minRound: 3,
      maxRound: 8,
      enoughForUnderstandingCard: false,
      shouldStopAsking: false
    },
    ui: {
      showReflectionCard: true,
      showQuestionCard: true,
      showQuickChoices: true,
      quickChoices: [
        { label: '顶嘴', value: '顶嘴' },
        { label: '沉默', value: '沉默' },
        { label: '拖着不动', value: '拖着不动' },
        { label: '表面答应', value: '表面答应' }
      ]
    },
    clientActions: { nextAction: 'continue_question', nextRoute: '/problem/follow-up' },
    safety: { riskLevel: 'none', needsHumanSupport: false, message: '' }
  },
  6: {
    schemaVersion: 'childos.a1.output.v1',
    ok: true,
    messageType: 'reflection_question',
    scene: 'problem_solving',
    assistantMessage: {
      text: '目前比较明确的是：这不像单纯“贪玩”，更像数学开始前的压力和催促后的抵触叠在一起。',
      tone: 'warm'
    },
    highlightQuestion: {
      text: '这种情况是最近突然变明显，还是已经持续一段时间了？',
      inputHint: '大概说一个时间范围就可以。'
    },
    progress: {
      currentRound: 6,
      minRound: 3,
      maxRound: 8,
      enoughForUnderstandingCard: false,
      shouldStopAsking: false
    },
    ui: {
      showReflectionCard: true,
      showQuestionCard: true,
      showQuickChoices: true,
      quickChoices: [
        { label: '最近才明显', value: '最近才明显' },
        { label: '持续一段时间', value: '持续一段时间' },
        { label: '说不清', value: '说不清' }
      ]
    },
    clientActions: { nextAction: 'continue_question', nextRoute: '/problem/follow-up' },
    safety: { riskLevel: 'none', needsHumanSupport: false, message: '' }
  },
  7: {
    schemaVersion: 'childos.a1.output.v1',
    ok: true,
    messageType: 'confirm_generate_card',
    scene: 'problem_solving',
    assistantMessage: {
      text: '我大概已经了解啦。现在的信息足够先形成一张阶段性的孩子理解卡。',
      tone: 'warm'
    },
    highlightQuestion: {
      text: '生成孩子理解卡前，你还有想补充的吗？',
      inputHint: '如果觉得差不多了，可以先看看我怎么理解这件事。'
    },
    progress: {
      currentRound: 7,
      minRound: 3,
      maxRound: 8,
      enoughForUnderstandingCard: true,
      shouldStopAsking: true
    },
    ui: { showReflectionCard: true, showQuestionCard: true, showQuickChoices: false },
    clientActions: { nextAction: 'confirm_generate_card', nextRoute: '/problem/confirm' },
    safety: { riskLevel: 'none', needsHumanSupport: false, message: '' }
  }
};

export function makeA1(round: number, familyId: string, childId: string, conversationId: string): A1Output {
  const base = prompts[Math.min(Math.max(round, 2), 7)] ?? prompts[7];
  return {
    ...base,
    familyId,
    childId,
    conversationId,
    messageId: `msg_${String(round).padStart(3, '0')}`,
    memoryCandidates: [
      {
        type: 'raw_event_candidate',
        summary: '家长提到孩子写数学作业前会先玩手机，一催就烦。',
        evidenceText: '孩子写数学作业前玩手机，一催就烦。'
      }
    ]
  };
}

export function makeUnderstandingCard(conversation: ConversationStateData, revision = 1, extra = ''): UnderstandingCardData {
  const isRevision = revision > 1;
  return {
    schemaVersion: 'childos.understanding_card.v1',
    ok: true,
    familyId: conversation.familyId,
    childId: conversation.childId,
    conversationId: conversation.conversationId,
    cardId: `uc_${conversation.conversationId}_${revision}`,
    title: isRevision ? '我对这件事的更新理解' : '我对这件事的当前理解',
    version: isRevision ? `v${revision}` : 'v1',
    isDraft: false,
    sections: [
      {
        id: 'current_state',
        title: '孩子当前的状态',
        body: '他可能不是单纯想玩手机，而是在开始写数学作业前就已经有一点压力和回避感。手机像是一个暂时躲开的出口。'
      },
      {
        id: 'stuck_point',
        title: '他真正卡住的地方',
        body: '他更像是卡在“开始之前”，而不只是写到一半分心。开始数学作业意味着要面对不会做、做得慢、被催或被评价。'
      },
      {
        id: 'parent_misread',
        title: '家长容易误会的地方',
        body: '你看到的是“又玩手机、又拖、不自觉”；但他心里更可能是“我还没准备好开始，一开始就怕发现自己不会”。'
      },
      {
        id: 'child_inner_voice',
        title: '孩子可能在想什么',
        body: ['我不是完全不想写，只是一想到数学就烦。', '你一催我，我就更不想动。', '我知道我拖了，但我不知道怎么进入状态。']
      },
      {
        id: 'observe_next',
        title: '接下来先观察什么',
        body: '下次类似情况发生时，可以先看：他最明显的拖延，是发生在刚准备开始的时候，还是已经做到某一题后卡住的时候。'
      },
      {
        id: 'basis',
        title: '这张卡的依据',
        body: `依据来自你刚刚提供的几个线索：数学作业、开始前玩手机、被催后烦、冲突反复出现。${extra ? `\n\n你补充的信息：${extra}` : ''}`
      }
    ],
    knowledgeSource: '参考了发展心理学、教育心理学、学习动机与拖延行为等相关研究，也结合了你刚刚提供的具体场景。',
    feedbackOptions: ['accurate', 'partially_inaccurate', 'edit', 'add_detail']
  };
}

export function makeRehearsal(conversationId: string, parentText: string): RehearsalResultData {
  return {
    schemaVersion: 'childos.rehearsal.output.v1',
    ok: true,
    conversationId,
    rehearsalId: `rh_${Date.now()}`,
    parentOriginal: parentText,
    childMayHear: '你又觉得我不自觉，你已经默认我做不好了。',
    likelyReaction: '他可能会马上进入防御状态：嘴上顶回去、拖着不动，或者表面答应、心里更抗拒开始。',
    saferExpression: '我看到你还没开始。今天数学里，最难开始的是哪一部分？',
    reason: '这句没有先把焦点放在指责上，而是先帮孩子把卡住的点说出来。'
  };
}

export function makeAdvice(conversationId: string): AdviceCardData {
  return {
    schemaVersion: 'childos.advice_card.v1',
    ok: true,
    conversationId,
    adviceId: `adv_${Date.now()}`,
    intro: '基于这次情况，我先给你几条更适合现在尝试的小建议。',
    items: [
      {
        title: '先做的一件事',
        body: '先别急着管手机。找一个轻松的时机问孩子：“数学里，最难开始的是哪一部分？”'
      },
      {
        title: '建议一',
        avoid: '你怎么又玩手机？',
        tryThis: '我看到你还没开始。今天数学里，最难开始的是哪一部分？',
        body: '这能把注意力从指责转到具体卡点，让孩子更容易说出真正卡住的地方。'
      },
      {
        title: '建议二',
        body: '把启动门槛降到最低。比如先读第一题，不用立刻做，读完再决定下一步。'
      },
      {
        title: '接下来先观察',
        observe: '观察他的回避是在开始数学前出现，还是卡在某一道题之后出现。'
      }
    ]
  };
}

export function makeArchive(conversation: ConversationStateData): ArchiveDraft {
  const rehearsalOrAdvice =
    conversation.rehearsalResult?.saferExpression ||
    conversation.adviceCard?.items
      .map((item) => item.tryThis || item.body || item.observe)
      .filter(Boolean)
      .join('；') ||
    '本次先把理解沉淀下来，后续继续观察启动点。';

  return {
    schemaVersion: 'childos.archive_draft.v1',
    ok: true,
    conversationId: conversation.conversationId,
    archiveId: `arch_${conversation.conversationId}`,
    date: new Date().toISOString().slice(0, 10),
    eventSummary: '孩子最近在写数学作业前经常先玩手机，家长一提醒，他就容易不耐烦，甚至拖延开始写作业。',
    conflictPoint: '表面上看，冲突集中在“玩手机”和“写作业拖拉”；更核心的冲突可能是：家长希望孩子尽快开始，孩子却在开始前感到压力，双方进入催促和抵触的循环。',
    currentClues: '孩子可能不是单纯想玩手机，而是在写作业开始前，尤其是面对数学任务时，有明显的压力和回避感。',
    rehearsalOrAdvice,
    observationNext: '下次类似情况发生时，可以继续观察：孩子最明显的拖延，是发生在刚要开始数学作业前，还是写到某一道题卡住之后。'
  };
}

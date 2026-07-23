export type OnboardingExampleTone = 'gentle' | 'vent' | 'rational' | 'humorous' | 'reflective'

export type OnboardingExample = {
  tone: OnboardingExampleTone
  quote: string
  meta: string
}

export type OnboardingLetterContent = {
  badge: string
  brandWord: string
  ledeRest: string
  accentParagraph: string
  leadParagraph: string
  closing: string
}

export type OnboardingGuideContent = {
  titleLines: [string, string]
  paragraph: string
  tipTitle: string
  tipCopy: string
  examples: OnboardingExample[]
  storyInviteEllipsis: string
  storyInviteCopy: string
  sendoff: string
}

export type OnboardingInfoContent = {
  letter: OnboardingLetterContent
  guide: OnboardingGuideContent
}

/** 真源：onboarding-info-compare.html · Impeccable 修正版（无第二 badge、无案例左色条） */
export const ONBOARDING_INFO_CONTENT: OnboardingInfoContent = {
  letter: {
    badge: '致家长的一封信',
    brandWord: '育见',
    ledeRest: '帮家长从日常对话里，慢慢读懂孩子。',
    accentParagraph:
      '由来自清华大学生命科学学院、计算机科学与技术系、美术学院及教育研究院的跨学科师生团队共同研发。',
    leadParagraph:
      '孩子的许多情绪与行为，并非孤立发生，而与成长经历、家庭互动和关系环境彼此交织。家庭未必是问题的起点，却往往是改变最有可能发生的地方。',
    closing: '理解彼此，是亲子共同成长的开始。',
  },
  guide: {
    titleLines: ['从日常出发，', '慢慢读懂孩子'],
    paragraph:
      '接下来，我们会从日常安排、作业过程、亲子沟通和家庭习惯四个方面，一起了解孩子真实的生活状态。',
    tipTitle: '按住语音按钮，顺着说就好',
    tipCopy:
      '可以说说当时发生了什么、谁说了什么，以及事情最后如何结束。细节越具体，育见形成的理解就越贴近孩子和家庭的真实情况。',
    examples: [
      {
        tone: 'gentle',
        quote:
          '我是全职妈妈，平时陪她时间多，孩子还算懂事，就是写作业拖拉，非常拖拉。昨晚 7:30 开始写，一直到晚上 10:40 才结束。我是不想催，但是看着就着急。',
        meta: '无锡 · 平和的全职妈妈 · 五年级',
      },
      {
        tone: 'vent',
        quote: '快没招了！饭也没吃，陪他写，他甩一句用不着你管，学校也不去！',
        meta: '沈阳 · 特别在意他，又不知怎么开口 · 初二',
      },
      {
        tone: 'rational',
        quote:
          '他最近的成绩有一些波动，也明显不太愿意和我们交流。我们家平时的沟通氛围还算开放，所以我不太想直接把它理解成叛逆。我会担心他是不是在学校里遇到了同学关系或者师生沟通方面的问题，但如果没有合适的时机，我也不想贸然追问，怕给他造成新的压力。',
        meta: '上海 · 担心学业，也怕问重了 · 高一',
      },
    ],
    storyInviteEllipsis: '...',
    storyInviteCopy: '期待您与孩子的故事',
    sendoff: '大概先说到这里~ 很高兴与你相遇。点「开始」，我们从你的日常说起。',
  },
}

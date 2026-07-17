/** 交流页 AI 单轮结构化输出（BFF final → 前端渲染） */

export type DailySectionKind = 'paragraphs' | 'list' | 'quotes' | 'mixed'

export type DailySection = {
  id: string
  label: string
  kind: DailySectionKind
  paragraphs?: string[]
  items?: string[]
  quotes?: string[]
  note?: string
  /** 默认折叠（深度分析 / 孩子视角） */
  hidden?: boolean
  /** 流式生成中的累积正文（未完成前 UI 展示） */
  streamingText?: string
}

export type DailyActionKind =
  | 'expand_sections'
  | 'rehearsal'
  | 'how_to_speak'
  | 'task'
  | 'follow_up_text'
  | 'navigate'

export type DailyAction = {
  id: string
  label: string
  kind: DailyActionKind
  primary?: boolean
  payload?: {
    sectionIds?: string[]
    route?: string
    seedText?: string
    sceneId?: string
    parentOriginalText?: string
    rehearsalGoal?: string
    hiddenReady?: boolean
    stashDeep?: boolean
    taskTitle?: string
  }
}

export type DailyThinkingChip = {
  label: string
  text: string
}

export type DailyAiPayload = {
  text: string
  sections: DailySection[]
  actions: DailyAction[]
  thinkingChips?: DailyThinkingChip[]
}

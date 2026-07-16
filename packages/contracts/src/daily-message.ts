export type DailySectionKind = 'paragraphs' | 'list' | 'quotes' | 'mixed'

export type DailySection = {
  id: string
  label: string
  kind: DailySectionKind
  paragraphs?: string[]
  items?: string[]
  quotes?: string[]
  note?: string
  hidden?: boolean
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
    stashDeep?: boolean
    taskTitle?: string
  }
}

export type DailyThinkingChip = {
  label: string
  text: string
}

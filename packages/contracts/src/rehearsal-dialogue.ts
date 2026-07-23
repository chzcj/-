/** 对话分析 V2-F · 节奏地图 + 第1/2步 + 完整一轮示范 */

export type DialogueDossierCell = {
  label: string
  body: string
}

export type DialoguePhaseQuote = {
  speaker: '家长' | '孩子'
  text: string
  isPeak?: boolean
}

export type DialoguePhase = {
  title: string
  timeRange?: string
  quoteCountHint?: string
  profileMatch: string
  quotes: DialoguePhaseQuote[]
}

export type DialogueTryTonightStep = {
  label: string
  text: string
}

export type DialogueSampleLine = {
  role: '家长' | '孩子'
  text: string
  stageDirection?: string
}

export type DialogueAnalysisMeta = {
  sceneLabel?: string
  durationHint?: string
  totalQuoteCount?: number
  phaseCount?: number
  highlightCount?: number
}

export type DialogueAnalysisV2 = {
  synthesis: string
  dossierCells: DialogueDossierCell[]
  phases: DialoguePhase[]
  tryTonightSteps: DialogueTryTonightStep[]
  sampleScene?: string
  sampleLines: DialogueSampleLine[]
  meta?: DialogueAnalysisMeta
}

export type DialogueAnalysisSegment = {
  speaker: string
  text: string
  highlight?: boolean
  highlightReason?: string
}

export type DialogueAnalysisPayload = {
  analysisId: string
  status: string
  summary: string
  analysis: string
  tryTonight: string
  sampleDialogue: string
  segments: DialogueAnalysisSegment[]
  rehearsalSeed?: Record<string, unknown>
  errorMessage?: string
  /** V2-F 结构化视图（新分析必有；旧记录由 BFF 适配） */
  v2?: DialogueAnalysisV2
  understandingBullets?: string[]
}

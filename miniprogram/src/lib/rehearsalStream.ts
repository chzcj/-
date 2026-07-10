/** 预演流式事件解析，对齐 Web src/types/rehearsal-stream.ts */

export type RehearsalStreamEvent =
  | { type: 'start'; traceId: string }
  | { type: 'reaction_delta'; delta: string }
  | { type: 'reaction_complete'; text: string }
  | { type: 'hearing_delta'; delta: string }
  | { type: 'hearing_complete'; text: string }
  | { type: 'suggested_delta'; delta: string }
  | { type: 'suggested_complete'; text: string }
  | {
      type: 'final'
      data: Record<string, unknown>
      traceId: string
    }
  | { type: 'error'; code: string; message: string }

export function parseRehearsalStreamEvent(line: string): RehearsalStreamEvent | null {
  if (!line.trim()) return null
  try {
    return JSON.parse(line) as RehearsalStreamEvent
  } catch {
    return null
  }
}

export type RehearsalAnalyzeData = {
  childLikelyHearing?: string
  possibleChildReaction?: {
    immediateReaction?: string
    innerReaction?: string
    behaviorRisk?: string
  }
  riskPoints?: string[]
  saferVersion?: string
  whyThisIsSafer?: string
  suggestedWording?: string
  taskTitle?: string
  closingAdvice?: string
  showSuggestedWording?: boolean
  dailyToneDetected?: boolean
  suggestedWordingHint?: string
  dailyToneReminder?: string
  explanation?: string
  traceId?: string
}

export function mapAnalyzeToSecondMe(data: RehearsalAnalyzeData) {
  const childText =
    data.possibleChildReaction?.immediateReaction?.trim() || '……（孩子暂时没有接话）'
  const hintTitle = '他可能是这样听到的'
  const hintText =
    data.childLikelyHearing ||
    data.possibleChildReaction?.innerReaction ||
    data.explanation ||
    '可以继续换一句更轻的开口方式。'
  return {
    childText,
    hintTitle,
    hintText,
    suggestedTitle: data.showSuggestedWording ? '您可以这样说' : undefined,
    suggestedText: data.showSuggestedWording
      ? data.suggestedWordingHint || data.saferVersion || data.suggestedWording
      : undefined,
    dailyToneReminder: data.dailyToneDetected ? data.dailyToneReminder : undefined,
  }
}

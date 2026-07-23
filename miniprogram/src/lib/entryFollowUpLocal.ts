import {
  evaluateEntryFollowUpGate,
  isEntryCaptureUsable,
  isMostlyParentLabels,
  countEntrySceneMarkers,
} from '@/lib/entryInputQuality'
import { MAX_ENTRY_FOLLOW_UP_ROUNDS } from '@/lib/entryAnalyze'

export { countEntrySceneMarkers, isMostlyParentLabels, isEntryCaptureUsable }

/**
 * 本地预检（capture/follow-up 页走服务端 runEntryFollowUp + entry-input-quality 同规则）。
 */
export function shouldContinueEntryFollowUp(
  combinedText: string,
  completedFollowUpRounds: number,
  maxRounds = MAX_ENTRY_FOLLOW_UP_ROUNDS,
): boolean {
  if (completedFollowUpRounds >= maxRounds) return false
  const gate = evaluateEntryFollowUpGate(combinedText)
  if (gate.releaseWithoutLlm) return false
  if (gate.forceShouldAsk) return true
  return completedFollowUpRounds < 1
}

export function shouldEnterFollowUpAfterCapture(combinedText: string): boolean {
  return shouldContinueEntryFollowUp(combinedText, 0)
}

export function createLocalFollowUpGate() {
  return { shouldAsk: true as const }
}

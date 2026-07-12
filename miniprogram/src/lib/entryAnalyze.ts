import type { BuildEntryType } from '@/lib/buildEntries'
import type { EntryFollowUpGate } from '@/services/entryStorage'
import { apiRequest } from '@/services/api'

export const MAX_ENTRY_FOLLOW_UP_ROUNDS = 3

export function hasSubmittableEntryText(text: string): boolean {
  return text.trim().length >= 2
}

export async function requestEntryFollowUp(
  entryType: BuildEntryType,
  rawText: string,
  appendMode = false
) {
  return apiRequest<EntryFollowUpGate & { shouldAsk?: boolean }>('/api/entry/analyze', {
    method: 'POST',
    data: { entryType, rawText, stage: 'entry', appendMode },
  })
}

export async function requestEntrySummary(
  entryType: BuildEntryType,
  rawText: string,
  appendMode = false
) {
  return apiRequest<{
    mainJudgment?: string
    facts?: string[]
    pendingHypotheses?: string[]
    note?: string
  }>('/api/entry/analyze', {
    method: 'POST',
    data: { entryType, rawText, stage: 'summary', appendMode },
  })
}

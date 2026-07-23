import type { BuildEntryType } from '@/lib/buildEntries'
import type { EntryFollowUpGate } from '@/services/entryStorage'
import { apiRequest } from '@/services/api'

export const MAX_ENTRY_FOLLOW_UP_ROUNDS = 3
/** 追问 gate 判定：比 summary 短，避免小程序 loading 挂太久 */
export const ENTRY_FOLLOWUP_REQUEST_TIMEOUT_MS = 35_000

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
    timeout: ENTRY_FOLLOWUP_REQUEST_TIMEOUT_MS,
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
    familyMap?: string
    sections?: Array<{ title: string; body: string }>
    sufficient?: boolean
  }>('/api/entry/analyze', {
    method: 'POST',
    data: { entryType, rawText, stage: 'summary', appendMode },
  })
}

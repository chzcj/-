import type { BuildEntryType } from '@/lib/profile/buildEntries'
import type { EntryFollowUpPayload } from '@/lib/storage/entryGateStorage'

export const MAX_ENTRY_FOLLOW_UP_ROUNDS = 3

export type EntrySummaryPayload = {
  mainJudgment: string
  facts: string[]
  pendingHypotheses: string[]
  note: string
  familyMap?: string
  sections?: Array<{ title: string; body: string }>
  sufficient?: boolean
}

type ApiError = {
  code?: string
  message?: string
  retriable?: boolean
}

export type EntryAnalyzeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }

async function postEntryAnalyze<T>(body: Record<string, unknown>): Promise<EntryAnalyzeResult<T>> {
  try {
    const res = await fetch('/api/entry/analyze', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (json.ok && json.data) {
      return { ok: true, data: json.data as T }
    }
    return {
      ok: false,
      error: {
        code: json.error?.code,
        message: json.error?.message || '这一步暂时没有整理成功，可以稍后再试。',
        retriable: json.error?.retriable !== false,
      },
    }
  } catch {
    return {
      ok: false,
      error: { message: '网络不太稳定，可以稍后再试。', retriable: true },
    }
  }
}

/** stage=entry：AI 判断是否继续追问，并生成追问内容 */
export function requestEntryFollowUp(entryType: BuildEntryType, rawText: string) {
  return postEntryAnalyze<EntryFollowUpPayload>({ entryType, rawText, stage: 'entry' })
}

/** stage=summary：AI 阶段整理（首轮 + 各轮追问合并文本） */
export function requestEntrySummary(entryType: BuildEntryType, rawText: string) {
  return postEntryAnalyze<EntrySummaryPayload>({ entryType, rawText, stage: 'summary' })
}

/** 四模块收尾综合追问（entryType=final） */
export function requestFinalFollowUp(rawText: string) {
  return postEntryAnalyze<EntryFollowUpPayload>({ entryType: 'final', rawText, stage: 'entry' })
}

export function hasSubmittableEntryText(text: string): boolean {
  return text.trim().length >= 2
}

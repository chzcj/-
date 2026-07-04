import { upsertStageSummary } from '@/lib/storage/entryStorage'

export function persistEntryStageSummary(
  entryType: string,
  data: {
    mainJudgment: string
    facts?: string[]
    pendingHypotheses?: string[]
    note?: string
  }
) {
  if (!data.mainJudgment?.trim()) return
  upsertStageSummary({
    entryType,
    mainJudgment: data.mainJudgment.trim(),
    facts: data.facts || [],
    pendingHypotheses: data.pendingHypotheses || [],
    note: data.note,
  })
}

import 'server-only'

import { listDialogueAnalysesForTenant, upsertDialogueAnalysis } from '@/lib/server/db'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import type { TenantId } from '@/lib/server/memory/tenant'
import { runDialogueAnalysis } from '@/lib/server/rehearsal/run-dialogue-analysis'

export function segmentsToTranscript(
  segments: Array<{ speaker?: string; text?: string }>
): string {
  if (!segments?.length) return ''
  if (segments.length === 1) {
    const only = segments[0]?.text?.trim() || ''
    if (only) return only
  }
  return segments
    .map((s) => {
      const speaker = (s.speaker || '家长').trim()
      const text = (s.text || '').trim()
      if (!text) return ''
      return `${speaker}：${text}`
    })
    .filter(Boolean)
    .join('\n')
}

export type DialogueBatchReanalyzeResult = {
  scanned: number
  skippedNoTranscript: number
  dryRunWouldRun: number
  reanalyzed: number
  insufficient: number
  failed: number
  items: Array<{
    analysisId: string
    status: 'dry_run' | 'done' | 'insufficient' | 'skipped' | 'error'
    message?: string
  }>
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 批量重跑 dialogueAnalysisV2（有 LLM 成本；覆盖同一 analysisId） */
export async function runDialogueBatchReanalyze(
  tenant: TenantId,
  opts: { limit?: number; dryRun?: boolean; onlyMissingV2?: boolean; delayMs?: number } = {}
): Promise<DialogueBatchReanalyzeResult> {
  const rows = await listDialogueAnalysesForTenant(tenant.familyId, tenant.childId, {
    limit: opts.limit,
    onlyMissingV2: opts.onlyMissingV2,
  })

  let digest = await loadDeepModelDigest(tenant).catch(() => null)
  if (!digest?.mechanismNarrative) {
    digest = await buildDeepModelDigest(tenant).catch(() => digest)
  }

  const result: DialogueBatchReanalyzeResult = {
    scanned: rows.length,
    skippedNoTranscript: 0,
    dryRunWouldRun: 0,
    reanalyzed: 0,
    insufficient: 0,
    failed: 0,
    items: [],
  }

  const delayMs = opts.delayMs ?? 400

  for (const row of rows) {
    const transcript = segmentsToTranscript(row.segments)
    const cjkChars = (transcript.match(/[一-鿿]/g) || []).length
    if (transcript.length < 10 || cjkChars < 8) {
      result.skippedNoTranscript++
      result.items.push({
        analysisId: row.analysisId,
        status: 'skipped',
        message: 'segments 无法还原有效 transcript',
      })
      continue
    }

    if (opts.dryRun) {
      result.dryRunWouldRun++
      result.items.push({ analysisId: row.analysisId, status: 'dry_run' })
      continue
    }

    try {
      const outcome = await runDialogueAnalysis({
        transcript,
        digest,
        analysisId: row.analysisId,
      })

      if (outcome.kind === 'insufficient') {
        await upsertDialogueAnalysis({
          analysisId: row.analysisId,
          familyId: row.familyId,
          childId: row.childId,
          status: 'insufficient',
          summary: '',
          analysis: '',
          tryTonight: '',
          sampleDialogue: '',
          segments: row.segments,
          rehearsalSeed: {},
          errorMessage: outcome.friendlyMessage,
        })
        result.insufficient++
        result.items.push({
          analysisId: row.analysisId,
          status: 'insufficient',
          message: outcome.friendlyMessage,
        })
      } else {
        await upsertDialogueAnalysis({
          analysisId: row.analysisId,
          familyId: row.familyId,
          childId: row.childId,
          status: 'done',
          summary: outcome.summary,
          analysis: outcome.analysis,
          tryTonight: outcome.tryTonight,
          sampleDialogue: outcome.sampleDialogue,
          segments: outcome.segments,
          rehearsalSeed: outcome.rehearsalSeed,
          errorMessage: '',
        })
        result.reanalyzed++
        result.items.push({ analysisId: row.analysisId, status: 'done' })
      }
    } catch (error) {
      result.failed++
      result.items.push({
        analysisId: row.analysisId,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }

    if (delayMs > 0) await sleep(delayMs)
  }

  return result
}

import { ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { loadLatestDialogueAnalysis } from '@/lib/server/db'
import { enrichDialogueAnalysisRow } from '@/lib/server/rehearsal/run-dialogue-analysis'

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const row = await loadLatestDialogueAnalysis(tenant.familyId, tenant.childId)
  if (!row) return ok({ analysisId: null, status: 'empty' })
  const { v2, segments } = enrichDialogueAnalysisRow(row)
  return ok({
    analysisId: row.analysisId,
    status: row.status,
    summary: row.summary,
    analysis: row.analysis,
    tryTonight: row.tryTonight,
    sampleDialogue: row.sampleDialogue,
    segments,
    rehearsalSeed: row.rehearsalSeed,
    v2,
    errorMessage: row.errorMessage,
  })
}

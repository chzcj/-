import { fail, ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { loadDialogueAnalysis, upsertDialogueAnalysis } from '@/lib/server/db'
import { newDialogueAnalysisId } from '@/lib/server/asr/file-recognize'
import {
  enrichDialogueAnalysisRow,
  runDialogueAnalysis,
} from '@/lib/server/rehearsal/run-dialogue-analysis'

function analysisIdOrNew(id?: string) {
  return id && id.startsWith('da_') ? id : newDialogueAnalysisId()
}

function packRow(row: NonNullable<Awaited<ReturnType<typeof loadDialogueAnalysis>>>) {
  const { v2, segments } = enrichDialogueAnalysisRow(row)
  return {
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
  }
}

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const url = new URL(request.url)
    const analysisId = url.searchParams.get('id') || ''
    if (!analysisId.startsWith('da_')) {
      return fail('BAD_REQUEST', '无效的分析 id', undefined, 400)
    }
    const row = await loadDialogueAnalysis(analysisId)
    if (!row) return fail('NOT_FOUND', '找不到这次分析', undefined, 404)
    return ok(packRow(row))
  } catch (error) {
    return failFromError(error)
  }
}

/** 文本重分析（覆盖同一 analysisId）；录音路径走 dialogue-transcribe */
export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const body = await request.json().catch(() => ({}))
    const transcript = String(body.transcript || '').trim()
    if (transcript.length < 10) {
      return fail('BAD_REQUEST', '对话内容太短，请多录几句原话。', undefined, 400)
    }

    const tenant = await resolveTenant()
    const analysisId = analysisIdOrNew(String(body.analysisId || ''))

    let digest = await loadDeepModelDigest(tenant).catch(() => null)
    if (!digest?.mechanismNarrative) {
      digest = await buildDeepModelDigest(tenant).catch(() => digest)
    }

    const cjkChars = (transcript.match(/[一-鿿]/g) || []).length
    if (cjkChars < 8) {
      const friendly = `这段录音里没有听到有效的亲子对话（转写结果是「${transcript.slice(0, 30)}」）。下次真实交流时再录一段就好。`
      await upsertDialogueAnalysis({
        analysisId,
        familyId: tenant.familyId,
        childId: tenant.childId,
        status: 'insufficient',
        summary: '',
        analysis: '',
        tryTonight: '',
        sampleDialogue: '',
        segments: [{ speaker: '家长', text: transcript }],
        rehearsalSeed: {},
        errorMessage: friendly,
      })
      return ok({ analysisId, status: 'insufficient', errorMessage: friendly })
    }

    const outcome = await runDialogueAnalysis({ transcript, digest, analysisId })

    if (outcome.kind === 'insufficient') {
      await upsertDialogueAnalysis({
        analysisId,
        familyId: tenant.familyId,
        childId: tenant.childId,
        status: 'insufficient',
        summary: '',
        analysis: '',
        tryTonight: '',
        sampleDialogue: '',
        segments: [{ speaker: '家长', text: transcript }],
        rehearsalSeed: {},
        errorMessage: outcome.friendlyMessage,
      })
      return ok({
        analysisId,
        status: 'insufficient',
        errorMessage: outcome.friendlyMessage,
      })
    }

    await upsertDialogueAnalysis({
      analysisId,
      familyId: tenant.familyId,
      childId: tenant.childId,
      status: 'done',
      summary: outcome.summary,
      analysis: outcome.analysis,
      tryTonight: outcome.tryTonight,
      sampleDialogue: outcome.sampleDialogue,
      segments: outcome.segments,
      rehearsalSeed: outcome.rehearsalSeed,
      errorMessage: '',
    })

    return ok({
      analysisId,
      status: 'done',
      summary: outcome.summary,
      analysis: outcome.analysis,
      tryTonight: outcome.tryTonight,
      sampleDialogue: outcome.sampleDialogue,
      segments: outcome.segments,
      rehearsalSeed: outcome.rehearsalSeed,
      v2: outcome.v2,
    })
  } catch (error) {
    return failFromError(error)
  }
}

import { fail, ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { requireFastJson } from '@/lib/server/daily/llm-required'
import { frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { agentPrompts } from '@/lib/server/agent-prompts'
import { loadDialogueAnalysis, upsertDialogueAnalysis } from '@/lib/server/db'
import { newDialogueAnalysisId } from '@/lib/server/asr/file-recognize'

function analysisIdOrNew(id?: string) {
  return id && id.startsWith('da_') ? id : newDialogueAnalysisId()
}

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const url = new URL(request.url)
    const analysisId = url.searchParams.get('id') || ''
    if (!analysisId) return fail('BAD_REQUEST', '缺少分析 id', undefined, 400)
    const row = await loadDialogueAnalysis(analysisId)
    if (!row) return fail('NOT_FOUND', '找不到这次分析', undefined, 404)
    return ok(row)
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
    const digestPack = pickDeepModelDigestPack(digest)

    const system = `${agentPrompts.parentFacingStyle}\n\n---\n\n${agentPrompts.deepModelingParentDigest}`
    const result = await requireFastJson<{
      summary: string
      segments: Array<{ speaker: string; text: string; highlight?: boolean; highlightReason?: string }>
      analysis: string
      tryTonight?: string
      sampleDialogue?: string
      rehearsalSeed?: {
        sceneTitle?: string
        sceneSummary?: string
        openingHint?: string
      }
    }>(
      system,
      {
        task:
          '分析亲子对话转写。speaker 只能是「家长」或「孩子」。输出 JSON：{ summary, segments, analysis, tryTonight, sampleDialogue, rehearsalSeed }。',
        transcript,
        deepModelDigest: digestPack,
      },
      // 转写后的亲子对话分析也是家长等待的前台路径；深度来自已注入的 digest。
      { maxTokens: 1800, disableThinking: frontAiThinkingDisabled() }
    )

    const segments = (result.segments || [])
      .map((s) => ({
        speaker: s.speaker === '孩子' ? '孩子' : '家长',
        text: String(s.text || '').trim(),
        highlight: Boolean(s.highlight),
        highlightReason: s.highlightReason,
      }))
      .filter((s) => s.text)

    const rehearsalSeed = {
      sceneTitle: result.rehearsalSeed?.sceneTitle || result.summary || '根据刚才的真实对话',
      sceneSummary: result.rehearsalSeed?.sceneSummary || result.summary || '',
      openingHint: result.rehearsalSeed?.openingHint || '',
      dialogueHighlights: segments.filter((s) => s.highlight).slice(0, 5),
      tryTonight: result.tryTonight || '',
      sampleDialogue: result.sampleDialogue || '',
      sourceAnalysisId: analysisId,
    }

    await upsertDialogueAnalysis({
      analysisId,
      familyId: tenant.familyId,
      childId: tenant.childId,
      status: 'done',
      summary: result.summary || '',
      analysis: result.analysis || '',
      tryTonight: result.tryTonight || '',
      sampleDialogue: result.sampleDialogue || '',
      segments,
      rehearsalSeed,
      errorMessage: '',
    })

    return ok({
      analysisId,
      status: 'done',
      summary: result.summary || '',
      analysis: result.analysis || '',
      tryTonight: result.tryTonight || '',
      sampleDialogue: result.sampleDialogue || '',
      segments,
      rehearsalSeed,
    })
  } catch (error) {
    return failFromError(error)
  }
}

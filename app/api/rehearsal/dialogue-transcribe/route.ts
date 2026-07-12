import { fail, ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { requireFastJson } from '@/lib/server/daily/llm-required'
import { agentPrompts } from '@/lib/server/agent-prompts'
import {
  isAsrConfigured,
  newDialogueAnalysisId,
  recognizeAudioFile,
} from '@/lib/server/asr/file-recognize'
import { upsertDialogueAnalysis } from '@/lib/server/db'

const MAX_BYTES = 15 * 1024 * 1024
const MIN_BYTES = 2000 // ~短于约 2s 的 mp3 近似下限

function detectVoiceFormat(fileName: string, mime: string): string {
  const name = fileName.toLowerCase()
  const type = mime.toLowerCase()
  if (name.endsWith('.wav') || type.includes('wav')) return 'wav'
  if (name.endsWith('.aac') || type.includes('aac')) return 'aac'
  if (name.endsWith('.m4a') || type.includes('m4a')) return 'm4a'
  if (name.endsWith('.pcm')) return 'pcm'
  return 'mp3'
}

/**
 * 亲子对话：整段录音上传 → 非实时文件 ASR → 自动深度分析 → 入库。
 * 不保留音频；segments 作为分析 JSON 快照。
 * 凭证与实时 ASR 共用 TENCENT_*，但调用录音文件识别 API（独立资源包）。
 */
export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    if (!isAsrConfigured()) {
      return fail('ASR_UNCONFIGURED', '语音暂时不可用，请稍后再试。', undefined, 503)
    }

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    const skipAnalyze = String(form?.get('skipAnalyze') || '') === '1'
    if (!file || !(file instanceof Blob)) {
      return fail('BAD_REQUEST', '请先完成录音。', undefined, 400)
    }
    if (file.size > MAX_BYTES) {
      return fail('BAD_REQUEST', '录音过长，请控制在约 10 分钟内。', undefined, 400)
    }
    if (file.size < MIN_BYTES) {
      return fail('BAD_REQUEST', '录音太短，请至少说满两秒。', undefined, 400)
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const fileName = typeof (file as File).name === 'string' ? (file as File).name : 'record.mp3'
    const mime = file.type || 'audio/mp3'
    const voiceFormat = detectVoiceFormat(fileName, mime)

    const tenant = await resolveTenant()
    const analysisId = newDialogueAnalysisId()

    await upsertDialogueAnalysis({
      analysisId,
      familyId: tenant.familyId,
      childId: tenant.childId,
      status: 'processing',
      summary: '',
      analysis: '',
      tryTonight: '',
      sampleDialogue: '',
      segments: [],
      rehearsalSeed: {},
      errorMessage: '',
    })

    let transcript = ''
    try {
      transcript = await recognizeAudioFile({
        base64Data: buf.toString('base64'),
        dataLen: buf.length,
        voiceFormat,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '转写失败'
      await upsertDialogueAnalysis({
        analysisId,
        familyId: tenant.familyId,
        childId: tenant.childId,
        status: 'failed',
        summary: '',
        analysis: '',
        tryTonight: '',
        sampleDialogue: '',
        segments: [],
        rehearsalSeed: {},
        errorMessage: message === 'ASR_UNCONFIGURED' ? '语音服务未配置' : message,
      })
      return fail('ASR_FAILED', message === 'ASR_UNCONFIGURED' ? '语音暂时不可用' : message, { analysisId }, 502)
    }

    // 按产品决策：不保留独立转写；若 skipAnalyze 则只返回临时文本（不入库成功态）
    if (skipAnalyze) {
      await upsertDialogueAnalysis({
        analysisId,
        familyId: tenant.familyId,
        childId: tenant.childId,
        status: 'skipped',
        summary: '',
        analysis: '',
        tryTonight: '',
        sampleDialogue: '',
        segments: [{ speaker: '家长', text: transcript }],
        rehearsalSeed: {},
        errorMessage: '',
      })
      return ok({ analysisId, status: 'skipped', transcript })
    }

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
          '分析亲子对话转写。speaker 只能是「家长」或「孩子」。输出 JSON：{ summary, segments, analysis, tryTonight, sampleDialogue, rehearsalSeed }。summary 为一句概览；sampleDialogue 为下次可试的整段示范对白；rehearsalSeed 含 sceneTitle/sceneSummary/openingHint 供沟通预演。',
        transcript,
        deepModelDigest: digestPack,
      },
      { maxTokens: 1800 }
    )

    const segments = (result.segments || []).map((s) => ({
      speaker: s.speaker === '孩子' ? '孩子' : '家长',
      text: String(s.text || '').trim(),
      highlight: Boolean(s.highlight),
      highlightReason: s.highlightReason,
    })).filter((s) => s.text)

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

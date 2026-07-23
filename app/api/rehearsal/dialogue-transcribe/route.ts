import { fail, ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import {
  isAsrConfigured,
  newDialogueAnalysisId,
  recognizeAudioFile,
} from '@/lib/server/asr/file-recognize'
import { upsertDialogueAnalysis } from '@/lib/server/db'
import { runDialogueAnalysis } from '@/lib/server/rehearsal/run-dialogue-analysis'

const MAX_BYTES = 15 * 1024 * 1024
const MIN_BYTES = 2000 // ~短于约 2s 的 mp3 近似下限

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

    const cjkChars = (transcript.match(/[一-鿿]/g) || []).length
    if (cjkChars < 8) {
      const friendly = `这段录音里没有听到有效的亲子对话（转写结果是「${transcript.slice(0, 30)}」）。下次真实交流时再录一段就好，哪怕只有几句。`
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
      return ok({ analysisId, status: 'insufficient', message: friendly, transcript })
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
      return ok({ analysisId, status: 'insufficient', message: outcome.friendlyMessage, transcript })
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

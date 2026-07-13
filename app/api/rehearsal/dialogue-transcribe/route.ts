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
    const digestPack = pickDeepModelDigestPack(digest)

    // ── 代码级有效性预门控（不依赖 LLM 判断，确定性拦截）──
    // 转写若基本没有中文实质内容（如「123。」「喂喂喂」），直接判定无效，
    // 绝不把垃圾输入交给分析 agent——否则模型只能拿 digest 里的长期机制编一套
    // 与本次录音无关的"死模板"分析（真实事故）。
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

    // 专业对话分析指令：门控优先、只析本次、digest 仅作背景校准（防死模板）
    const DIALOGUE_ANALYST_RULES = `
---

你现在的具体身份：「育见」的亲子真实对话分析 Agent。家长录了一段与孩子的真实相处对话，语音转写后交给你。你只分析【这一次对话里实际发生的内容】。

第一优先级·有效性门控：
- 先判断 transcript 是否包含真实的亲子交流（谁对谁说了关于什么的事）。
- 若内容无意义（报数/测试音/单字重复/与亲子相处无关的杂音转写），只输出：
  { "insufficient": true, "friendlyMessage": "一句温和说明为什么没法分析 + 邀请下次真实交流时再录" }
  其余字段一律不输出。宁可说"没听到有效对话"，也绝不硬造分析。

只析本次（防模板化）：
- deepModelDigest 是这个家庭的长期背景，只能用来校准理解和语气，**禁止把其中的机制、结论、建议当作本次对话的分析结果输出**——本次转写里没有出现的事，一个字都不能写进 analysis。
- analysis 中的每个判断必须能对应到 transcript 里的具体话轮，关键处用「」引用原话。
- 对话很短或信息很薄时：只做浅观察 + 说明想进一步听到什么，省略 tryTonight 和 sampleDialogue，不硬凑。

有效时输出 JSON：{ summary, segments, analysis, tryTonight?, sampleDialogue?, rehearsalSeed? }（speaker 只能是「家长」或「孩子」）。`

    const system = `${agentPrompts.parentFacingStyle}\n\n---\n\n${agentPrompts.deepModelingParentDigest}${DIALOGUE_ANALYST_RULES}`
    const result = await requireFastJson<{
      insufficient?: boolean
      friendlyMessage?: string
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
          '分析亲子对话转写。先做有效性门控（见 system）。有效时输出 JSON：{ summary, segments, analysis, tryTonight, sampleDialogue, rehearsalSeed }。summary 为一句概览；sampleDialogue 为下次可试的整段示范对白；rehearsalSeed 含 sceneTitle/sceneSummary/openingHint 供沟通预演。',
        transcript,
        deepModelDigest: digestPack,
      },
      { maxTokens: 1800 }
    )

    // LLM 级门控命中：语义上不是有效亲子对话
    if (result.insufficient) {
      const friendly =
        result.friendlyMessage?.trim() ||
        '这段录音里没有听到有效的亲子对话，下次真实交流时再录一段就好。'
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

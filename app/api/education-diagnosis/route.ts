import { NextResponse } from 'next/server'
import { callAgentJson } from '@/lib/server/ark-agents'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildEducationDiagnosisRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { buildMemoryWritePlan, createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import { decideFeatureUI, normalizeReadiness } from '@/lib/server/features/feature-ui-router'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { createId } from '@/lib/storage/storageIds'

/* ================================================================
   教育模式诊断 education_diagnosis（交付文档 5.3）
   专项采集 ↔ 轻追问 动态切换：LLM 判 readiness，FeatureUIRouter 决定 uiMode。
   信息不足只追问、不硬生成；前台不暴露 readiness 等后台字段（红线）。
   ================================================================ */

type KeyTension = { title: string; detail: string }
type EduDiagOutput = {
  readiness?: string
  missingHighImpactFacts?: string[]
  acknowledgement?: string
  modeReading?: string
  keyTensions?: KeyTension[]
  gentleNextStep?: string
  lightFollowupPrompt?: string
  collectionGuide?: string
}

// 无 key / LLM 失败时的降级文案：停在专项采集，引导家长多讲，不退化。
const FALLBACK_GUIDE = '教育模式诊断不是判断你做得好不好，而是看这个家每天和周末怎么运转。你可以像讲生活流水一样多说一点：孩子放学后怎么过、周末怎么安排、谁主要管学习、孩子有没有一段真正属于自己的时间。'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const body = await request.json().catch(() => ({}))
    const { text = '', priorTurns = [] } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message: '可以像讲生活流水一样，多说说孩子平时和周末怎么过' }
      }, { status: 400 })
    }

    const userText = text.trim()
    // 本会话已讲过的轮次（前端累积透传）：消除"异步写入未落库→下一轮检索不到"的竞态，
    // 让 LLM 始终看到完整对话上下文，状态机不断（不依赖后台写入时机）。
    const sessionTurns = Array.isArray(priorTurns)
      ? priorTurns.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0).slice(-8)
      : []
    const traceId = createId('trace')
    const tenant = await resolveTenant()

    // 带出既往已采集的生活流水事实，供 LLM 判 readiness。
    const packet = await buildEducationDiagnosisRetrievalPacket(userText, tenant)

    const ai = await callAgentJson<EduDiagOutput>(
      'educationDiagnosis',
      '结合家长本会话之前已经讲过的内容（sessionTurns）、本轮输入（userText）与已掌握的家庭事实（knownFacts/recentEducationEvents），判断信息是否足够诊断教育模式。足够就给整体运转读取与关键张力点；不够就只追问最关键的一类要素。',
      {
        userText,
        sessionTurns,
        knownFacts: packet.knownFacts,
        recentEducationEvents: packet.recentEducationEvents,
        childUnderstanding: packet.childUnderstanding
      }
    ).catch((err) => {
      console.error(`[education-diagnosis] LLM 调用失败 traceId=${traceId}:`, err)
      return undefined
    })

    const readiness = normalizeReadiness(ai?.readiness)
    const missingHighImpactFacts = Array.isArray(ai?.missingHighImpactFacts)
      ? ai!.missingHighImpactFacts.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : []

    // 已有上下文：本轮已提交文本 + 既往历史。FeatureUIRouter 据 readiness 决定 uiMode（文档 5.3.6）。
    const router = decideFeatureUI({
      featureType: 'education_diagnosis',
      hasExistingContextPack: true,
      contextReadiness: readiness,
      missingHighImpactFacts,
      userIntent: 'unclear',
      currentQuestionSpan: 'same_topic'
    })

    // 把本次采集输入写回记忆（异步，不阻塞）：dailyUpdate 累积 + Episode 抽取，下次检索带出。
    const writePlan = buildMemoryWritePlan({
      tenant,
      dailyUpdates: [createDailyUpdate(
        `[教育诊断] ${userText}`,
        'insufficient', // 采集叙述，不误增稳定画像权重
        [],
        tenant,
        traceId
      )],
      rationale: {
        whyUpdate: '教育模式诊断采集，记录本次家庭日常叙述',
        whyNotPromoteSomeItems: '采集叙述属上下文，暂不升级为长期判断',
        riskOfOvergeneralization: '',
        nextVerificationNeed: missingHighImpactFacts.join('；')
      }
    })
    void enqueueJob('memory_write', { plan: writePlan, tenant }, null, traceId)
    // Episode 抽取统一走队列（对齐 daily / 其它专项）：可追踪、可重试、幂等。
    const episodeId = deriveEpisodeId(userText, { familyId: tenant.familyId, childId: tenant.childId })
    void enqueueJob('episode_ingest', {
      text: userText,
      ctx: { sourceEventId: traceId, familyId: tenant.familyId, childId: tenant.childId, episodeId }
    }, episodeId, traceId)

    // ready 但内容为空时降级为轻追问，不返回空结果卡（避免前台显示空 result_view）。
    const modeReading = textOr(ai?.modeReading, '')
    const keyTensions = normalizeTensions(ai?.keyTensions)
    const hasResultContent = Boolean(modeReading || keyTensions.length > 0)
    const uiMode = router.uiMode === 'result_view' && !hasResultContent ? 'light_followup' : router.uiMode

    // 前台安全返回：只给 uiMode + 自然语言，绝不含 readiness/coverage 等后台字段（红线 5）。
    const acknowledgement = textOr(ai?.acknowledgement, '我先不急着下结论，想先弄清你们家每天和周末大概怎么运转。')
    return NextResponse.json({
      ok: true,
      data: {
        traceId,
        uiMode,
        acknowledgement,
        // 还想多了解的方面（自然语言，非数值）——仅在未就绪时给。
        missingInfo: uiMode === 'result_view' ? [] : missingHighImpactFacts,
        // 轻追问（只问一个关键点）
        followupPrompt: uiMode === 'light_followup'
          ? textOr(ai?.lightFollowupPrompt, '这里先看一个点：周末有没有一段真正属于孩子自己、不被安排也不被临时加任务的时间？')
          : '',
        // 专项采集引导（信息几乎为空时）
        collectionGuide: uiMode === 'special_collection'
          ? textOr(ai?.collectionGuide, FALLBACK_GUIDE)
          : '',
        // 正式结果（仅就绪且有内容时）
        result: uiMode === 'result_view'
          ? { modeReading, keyTensions, gentleNextStep: textOr(ai?.gentleNextStep, '') }
          : null
      }
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'EDUCATION_DIAGNOSIS_ERROR', message: String(error) }
    }, { status: 500 })
  }
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeTensions(value: unknown): KeyTension[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is KeyTension =>
      Boolean(item) && typeof item === 'object'
      && typeof (item as KeyTension).title === 'string'
      && typeof (item as KeyTension).detail === 'string'
      && (item as KeyTension).title.trim().length > 0)
    .slice(0, 3)
    .map((item) => ({ title: item.title.trim(), detail: item.detail.trim() }))
}

import 'server-only'

import type { MaturityLevel, OrchestrationOutput } from '@/types/database'
import type { DailyCards } from '@/types/database'
import type { DailyAction, DailySection } from '@/types/daily-message'
import {
  runOrchestrationPipeline,
  deriveLinkedAreas,
  buildDailyCards,
} from '@/lib/server/orchestration/pipeline'
import { flattenParentUnderstanding } from '@/lib/server/memory/retrieval/router'
import { composeDailyActions } from '@/lib/server/daily/action-composer'
import { composeDailySections } from '@/lib/server/daily/section-composer'
import {
  buildDailyProsePayload,
  buildDailyProseTask,
  clampProse,
  resolveProseMode,
} from '@/lib/server/daily/prose-context'
import { applySectionPolicy } from '@/lib/server/daily/section-policy'
import { dedupeProseFromSections } from '@/lib/server/daily/prose-dedupe'
import { isFastAIEnabled, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import {
  combinedProseSystem,
  fillDailySectionCopy,
  parentFacingPromptCacheInfo,
} from '@/lib/server/daily/parent-facing-copy'
import { streamProseAndSections } from '@/lib/server/daily/prose-section-stream'
import { requireTextStream } from '@/lib/server/daily/llm-required'
import type { TenantId } from '@/lib/server/memory/tenant'
import { createId } from '@/lib/storage/storageIds'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { getLatestDossier } from '@/lib/server/memory/deep-modeling/digest-store'
import { pickDefaultTaskTitle } from '@/lib/server/memory/dossier/dossier-slicer'

export type DailyRuntimeFlags = {
  fastAiEnabled: boolean
  llmProseUsed: boolean
  llmSectionCopyUsed: boolean
  mergedSpCall?: boolean
  fallbackUsed: boolean
  retrievalUsed: boolean
  retrievalEpisodeCount: number
  proseLen?: number
  visibleSectionCount?: number
  sectionIdsCompleted?: string[]
  taskTitlePresent?: boolean
  promptCache: ReturnType<typeof parentFacingPromptCacheInfo>
}

export type DailyTurnTiming = {
  orchestrationMs: number
  proseFirstMs: number | null
  parallelMs: number
  sectionsMs: number
  hiddenMs: number
  totalMs: number
}

export type DailyTurnBffResult = {
  output: OrchestrationOutput
  traceId: string
  linkedAreas: string[]
  finalText: string
  sections: DailySection[]
  actions: DailyAction[]
  cards: DailyCards
  isSafety: boolean
  runtime: DailyRuntimeFlags
  timing: DailyTurnTiming
}

async function generateDailyProse(
  output: OrchestrationOutput,
  userText: string,
  digestPack: Awaited<ReturnType<typeof ensureDigestPack>>,
  onDelta?: (delta: string) => void
): Promise<string> {
  if (output.relationshipToExistingModel.type === 'safety') {
    const safetyText = output.frontResponseDraft.trim()
    if (onDelta) onDelta(safetyText)
    return safetyText
  }

  const prosePayload = buildDailyProsePayload(output, userText, { deepModelDigest: digestPack })
  const task = buildDailyProseTask(output, userText)

  return requireTextStream(combinedProseSystem(), task, prosePayload, onDelta, {
    maxTokens: 1024,
    disableThinking: frontAiThinkingDisabled(),
  })
}

async function ensureDigestPack(tenant: TenantId) {
  let digestPack = pickDeepModelDigestPack(await loadDeepModelDigest(tenant).catch(() => null))
  if (!digestPack.mechanismNarrative && !digestPack.anchoredFacts.length) {
    try {
      const built = await buildDeepModelDigest(tenant)
      digestPack = pickDeepModelDigestPack(built)
    } catch {
      /* 无 digest 时降级 retrievalPack */
    }
  }
  return digestPack
}

export async function runDailyTurnBff(args: {
  userText: string
  maturityLevel?: MaturityLevel
  tenant: TenantId
  traceId?: string
  recentSectionIds?: string[]
  warmTurn?: boolean
  onDelta?: (delta: string) => void
  onProseComplete?: () => void
  onSectionStart?: (section: DailySection) => void
  onSectionDelta?: (id: string, text: string) => void
  onSectionComplete?: (section: DailySection) => void
  onSectionError?: (id: string, message?: string) => void
  onSectionsComplete?: (sections: DailySection[]) => void
  onSections?: (sections: DailySection[]) => void
  onActions?: (actions: DailyAction[]) => void
  /** orchestration 完成即回调，用于尽早推 thinking 四宫格 */
  onOrchestration?: (output: OrchestrationOutput) => void
}): Promise<DailyTurnBffResult> {
  const traceId = args.traceId || createId('trace')
  const userText = args.userText.trim()

  const t0 = Date.now()
  const [digestPack, output] = await Promise.all([
    ensureDigestPack(args.tenant),
    runOrchestrationPipeline({
      userText,
      maturityLevel: args.maturityLevel,
      tenant: args.tenant,
      warmTurn: args.warmTurn,
    }),
  ])
  args.onOrchestration?.(output)
  const tOrch = Date.now()

  const isSafety = output.relationshipToExistingModel.type === 'safety'
  const linkedAreas = deriveLinkedAreas(userText)
  const cards = isSafety ? {} : buildDailyCards(output, userText)

  const proseMode = resolveProseMode(output, userText)
  const clampMeta = { traceId, familyId: args.tenant.familyId }
  const skeletons = isSafety ? [] : composeDailySections(output, cards, userText)
  let llmSectionCopyUsed = false
  let taskTitleFromSections: string | undefined

  // 并行：正文流式 与 前台可见 section 文案填充同时进行（两者都只依赖 output，互不依赖）。
  // hidden section 内容延后到后台第二次调用，不阻塞前台 sections/actions 输出。
  let visibleSkeletons = skeletons.filter((s) => !s.hidden)
  let hiddenSkeletons = skeletons.filter((s) => s.hidden)

  let finalText = ''
  let visibleFilled: DailySection[] = []
  let tProseFirst: number | null = null
  let hiddenPromise: Promise<{ sections: DailySection[]; taskTitle?: string }> | null = null

  const ACTIONS_PAUSE_MS = 0

  if (isSafety) {
    finalText = await generateDailyProse(output, userText, digestPack, args.onDelta)
    finalText = clampProse(finalText, proseMode, clampMeta)
  } else {
    // 合并 prose + visible section 为一次 LLM 调用（streamProseAndSections）。
    // 收益：消除 prose 与 section 两次并发请求在 provider 侧排队等待（实测 prose 完成后
    // section 首字要再等 7.6s），prose 完成后 section marker 紧接流式，真正无缝衔接。
    // 顺序天然保证：LLM 先输出 prose，再按 visibleAfterPolicy 顺序输出 section marker + 内容。
    const policyApplied = applySectionPolicy(
      [...visibleSkeletons, ...hiddenSkeletons],
      args.recentSectionIds || [],
      4
    )
    const visibleAfterPolicy = policyApplied.filter((s) => !s.hidden)
    const hiddenAfterPolicy = policyApplied.filter((s) => s.hidden)

    const completedSections = new Map<string, DailySection>()

    // hidden section 预取：与主调用并行（不阻塞前台，final 前完成即可）。
    // 用户点开"深度展开"时 hidden 文案已就绪，直接呈现，不再现场等 LLM。
    if (hiddenAfterPolicy.length) {
      // hidden 与可见 section 共用同一 digest，避免「深度展开」无家庭记忆饿死
      hiddenPromise = fillDailySectionCopy(hiddenAfterPolicy, output, userText, {
        deepModelDigest: digestPack,
      }).catch(() => ({ sections: hiddenAfterPolicy }))
    }

    // 一次 LLM 调用：prose 流式 → prose_complete → section 紧接流式
    const mainResult = await streamProseAndSections(
      output,
      userText,
      visibleAfterPolicy,
      {
        deepModelDigest: digestPack,
        clampMeta,
        onProseDelta: (delta) => {
          if (tProseFirst === null) tProseFirst = Date.now()
          args.onDelta?.(delta)
        },
        onProseComplete: () => args.onProseComplete?.(),
        onSectionStart: (section) => args.onSectionStart?.(section),
        onSectionDelta: (id, text) => args.onSectionDelta?.(id, text),
        onSectionComplete: (section) => {
          completedSections.set(section.id, section)
          args.onSectionComplete?.(section)
        },
        onSectionError: (id, msg) => args.onSectionError?.(id, msg),
      }
    )
    finalText = mainResult.prose
    visibleFilled = mainResult.sections
    taskTitleFromSections = mainResult.taskTitle
    if (!taskTitleFromSections && output.routingDecision.frontResponseType === 'advice_from_dossier') {
      const dossier = await getLatestDossier(args.tenant).catch(() => null)
      taskTitleFromSections = pickDefaultTaskTitle(dossier)
    }
    llmSectionCopyUsed = true

    hiddenSkeletons.length = 0
    hiddenSkeletons.push(...hiddenAfterPolicy)
  }
  const tParallel = Date.now()

  // 合并：前台 visible（已填文案）+ hidden（仍是空骨架，但 id/label 可用于 actions）
  let sections = isSafety ? [] : [...visibleFilled, ...hiddenSkeletons]
  if (!isSafety && sections.length) {
    finalText = dedupeProseFromSections(finalText, sections)
    finalText = clampProse(finalText, proseMode, clampMeta)
    args.onSectionsComplete?.(sections)
    args.onSections?.(sections)
  }

  await new Promise((r) => setTimeout(r, ACTIONS_PAUSE_MS))

  // actions 在 sections 全部完成后才 compose 并发出（3A + 300ms）
  let actions = isSafety
    ? []
    : composeDailyActions(output, cards, sections, finalText, taskTitleFromSections, userText)
  if (!isSafety) args.onActions?.(actions)
  const tSections = Date.now()

  // hidden section：与 visible/prose 并行预取已完成，合并结果（不阻塞前台已发的 sections/actions）。
  if (!isSafety && hiddenPromise) {
    try {
      const hiddenFilled = await hiddenPromise
      const byId = new Map(hiddenFilled.sections.map((s) => [s.id, s]))
      sections = sections.map((s) => byId.get(s.id) ?? s)
      // 再发一次 sections 事件，前端把 hidden 内容合并进去（供"查看深度展开"使用）
      args.onSections?.(sections)
      // hidden 已就绪后重算 action，让“生成中”恢复为可点击的深度展开。
      actions = composeDailyActions(output, cards, sections, finalText, taskTitleFromSections, userText)
      args.onActions?.(actions)
    } catch {
      // hidden 填充失败：保留骨架，展开时由 understanding-card 兜底；不影响前台
    }
  }
  const tHidden = Date.now()

  const finalCards = isSafety ? cards : { ...cards, sections, actions }

  const ctx = output.retrievedContext
  const retrievalEpisodeCount =
    (ctx.relevantPastEvents?.length || 0) + (ctx.relevantEntryEvidencePacks?.length || 0)

  return {
    output,
    traceId,
    linkedAreas,
    finalText,
    sections,
    actions,
    cards: finalCards,
    isSafety,
    runtime: {
      fastAiEnabled: isFastAIEnabled(),
      llmProseUsed: !isSafety,
      llmSectionCopyUsed,
      mergedSpCall: llmSectionCopyUsed,
      fallbackUsed: false,
      retrievalUsed: retrievalEpisodeCount > 0 || (ctx.matchedMechanisms?.length || 0) > 0,
      retrievalEpisodeCount,
      proseLen: finalText.length,
      visibleSectionCount: visibleFilled.length,
      sectionIdsCompleted: visibleFilled.map((s) => s.id),
      taskTitlePresent: Boolean(taskTitleFromSections?.trim()),
      promptCache: parentFacingPromptCacheInfo(),
    },
    timing: {
      orchestrationMs: tOrch - t0,
      proseFirstMs: tProseFirst !== null ? tProseFirst - tOrch : null,
      parallelMs: tParallel - tOrch,
      sectionsMs: tSections - t0,
      hiddenMs: tHidden - tSections,
      totalMs: tHidden - t0,
    },
  }
}

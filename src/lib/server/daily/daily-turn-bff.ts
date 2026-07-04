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
import { isFastAIEnabled } from '@/lib/server/ark-agents'
import {
  combinedProseSystem,
  fillDailySectionCopy,
  parentFacingPromptCacheInfo,
  streamDailySectionCopy,
} from '@/lib/server/daily/parent-facing-copy'
import type { SectionStreamCallbacks } from '@/lib/server/daily/section-stream'
import { requireTextStream } from '@/lib/server/daily/llm-required'
import type { TenantId } from '@/lib/server/memory/tenant'
import { createId } from '@/lib/storage/storageIds'

export type DailyRuntimeFlags = {
  fastAiEnabled: boolean
  llmProseUsed: boolean
  llmSectionCopyUsed: boolean
  fallbackUsed: boolean
  retrievalUsed: boolean
  retrievalEpisodeCount: number
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
  onDelta?: (delta: string) => void
): Promise<string> {
  if (output.relationshipToExistingModel.type === 'safety') {
    const safetyText = output.frontResponseDraft.trim()
    if (onDelta) onDelta(safetyText)
    return safetyText
  }

  const prosePayload = buildDailyProsePayload(output, userText)
  const task = buildDailyProseTask(output)

  return requireTextStream(combinedProseSystem(), task, prosePayload, onDelta)
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
  const output = await runOrchestrationPipeline({
    userText,
    maturityLevel: args.maturityLevel,
    tenant: args.tenant,
    warmTurn: args.warmTurn,
  })
  args.onOrchestration?.(output)
  const tOrch = Date.now()

  const isSafety = output.relationshipToExistingModel.type === 'safety'
  const linkedAreas = deriveLinkedAreas(userText)
  const cards = isSafety ? {} : buildDailyCards(output, userText)

  const proseMode = resolveProseMode(output)
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

  const ACTIONS_PAUSE_MS = 300

  if (isSafety) {
    finalText = await generateDailyProse(output, userText, args.onDelta)
    finalText = clampProse(finalText, proseMode)
  } else {
    // Plan P2：prose 真流式 → prose_complete → 单次 marker 流式
    // （1 次 LLM 生成全部 visible section，按 ---section:id--- 标记增量触发 start/delta/complete，
    //  无 50ms 节流、无 N 次 LLM，section 首字紧跟 prose 完成）。
    const policyApplied = applySectionPolicy(
      [...visibleSkeletons, ...hiddenSkeletons],
      args.recentSectionIds || [],
      4
    )
    const visibleAfterPolicy = policyApplied.filter((s) => !s.hidden)
    const hiddenAfterPolicy = policyApplied.filter((s) => s.hidden)

    finalText = await generateDailyProse(output, userText, (delta) => {
      if (tProseFirst === null) tProseFirst = Date.now()
      args.onDelta?.(delta)
    })
    finalText = clampProse(finalText, proseMode)
    args.onProseComplete?.()

    if (visibleAfterPolicy.length) {
      // 捕获已完成 section，供 marker 流式整体/部分失败时兜底（已完成的有效，未完成发 error）
      const completedSections = new Map<string, DailySection>()
      const streamCallbacks: SectionStreamCallbacks = {
        onSectionStart: args.onSectionStart,
        onSectionDelta: args.onSectionDelta,
        onSectionComplete: (section) => {
          completedSections.set(section.id, section)
          args.onSectionComplete?.(section)
        },
      }
      try {
        const result = await streamDailySectionCopy(visibleAfterPolicy, output, userText, streamCallbacks)
        visibleFilled = result.sections
        taskTitleFromSections = result.taskTitle
        llmSectionCopyUsed = true
      } catch (err) {
        // marker 流式失败或部分 section 缺失：已完成的有效，未完成发 section_error 并保留骨架
        const message = err instanceof Error ? err.message : '这部分未生成'
        for (const sk of visibleAfterPolicy) {
          if (!completedSections.has(sk.id)) {
            args.onSectionError?.(sk.id, message)
          }
        }
        visibleFilled = visibleAfterPolicy.map((sk) => completedSections.get(sk.id) ?? sk)
      }
    } else {
      visibleFilled = []
    }

    hiddenSkeletons.length = 0
    hiddenSkeletons.push(...hiddenAfterPolicy)
  }
  const tParallel = Date.now()

  // 合并：前台 visible（已填文案）+ hidden（仍是空骨架，但 id/label 可用于 actions）
  let sections = isSafety ? [] : [...visibleFilled, ...hiddenSkeletons]
  if (!isSafety && sections.length) {
    finalText = dedupeProseFromSections(finalText, sections)
    finalText = clampProse(finalText, proseMode)
    args.onSectionsComplete?.(sections.filter((s) => !s.hidden))
    args.onSections?.(sections)
  }

  await new Promise((r) => setTimeout(r, ACTIONS_PAUSE_MS))

  // actions 在 sections 全部完成后才 compose 并发出（3A + 300ms）
  const actions = isSafety ? [] : composeDailyActions(output, cards, sections, finalText, taskTitleFromSections)
  if (!isSafety) args.onActions?.(actions)
  const tSections = Date.now()

  // 后台异步：填充 hidden section 文案（不阻塞前台已发的 sections/actions）
  if (!isSafety && hiddenSkeletons.length) {
    try {
      const hiddenFilled = await fillDailySectionCopy(hiddenSkeletons, output, userText)
      const byId = new Map(hiddenFilled.sections.map((s) => [s.id, s]))
      sections = sections.map((s) => byId.get(s.id) ?? s)
      // 再发一次 sections 事件，前端把 hidden 内容合并进去（供"查看深度展开"使用）
      args.onSections?.(sections)
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
      fallbackUsed: false,
      retrievalUsed: retrievalEpisodeCount > 0 || (ctx.matchedMechanisms?.length || 0) > 0,
      retrievalEpisodeCount,
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

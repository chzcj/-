import type { OrchestrationOutput, TurnEvent, RetrievedContext, RoutingDecision, MemoryAction } from '@/types/database'
import {
  buildDailyProsePayload,
  buildDailyProseTask,
  clampProse,
  resolveProseMode,
  resolveProseRouting,
} from '@/lib/server/daily/prose-context'
import { combinedProseSystem } from '@/lib/server/daily/parent-facing-copy'
import { requireTextStream } from '@/lib/server/daily/llm-required'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { InputClassification, InputTypeLabel, MaturityLevel } from '@/types/database'

const DEFAULT_RELATIONSHIP = {
  type: 'insufficient' as InputClassification,
  explanation: 'replay',
  confidence: 'low' as const,
}

const DEFAULT_ROUTING: RoutingDecision = {
  frontResponseType: 'model_based_explanation',
  needFollowup: false,
  followupQuestion: '',
  needMemoryWrite: false,
  needDeepDiagnosis: false,
  needResynthesis: false,
}

const DEFAULT_MEMORY_ACTION: MemoryAction = {
  writeRawFact: [],
  writeGrowthRecord: [],
  updatePendingHypothesis: [],
  updateStableProfile: [],
  updateFamilyInteractionPattern: [],
  updateWeeklyReportMaterial: [],
  doNotWrite: [],
}

const EMPTY_RETRIEVED: RetrievedContext = {
  relevantChildStructureModel: [],
  relevantEntryEvidencePacks: [],
  relevantPastEvents: [],
  relevantPendingHypotheses: [],
  relevantFamilyInteractionPatterns: [],
  matchedMechanisms: [],
  recentDiagnosis: [],
  parentNarrativePattern: [],
  childQuotes: [],
  entryFacts: [],
}

/** 从 TurnEvent 快照还原 OrchestrationOutput（仅 prose replay 用） */
export function turnEventToOrchestrationOutput(event: TurnEvent): OrchestrationOutput {
  const rel = event.relationship || DEFAULT_RELATIONSHIP
  const route = event.routingDecisionSnapshot || DEFAULT_ROUTING
  const memory = event.memoryActionSnapshot || DEFAULT_MEMORY_ACTION

  return {
    agent: 'daily_dialogue_orchestration_agent',
    contextMaturityLevel: (event.maturityLevel || 'L2') as MaturityLevel,
    inputType: (event.inputType || 'scene_report') as InputTypeLabel,
    retrievedContext: event.retrievedContextSnapshot || EMPTY_RETRIEVED,
    relationshipToExistingModel: rel,
    routingDecision: route,
    memoryAction: memory,
    frontResponseDraft: event.assistantReply || '',
  }
}

/** 用当前 workspace SP + LLM 重跑 prose（与 daily-turn-bff generateDailyProse 同路径） */
export async function replayDailyProse(args: {
  event: TurnEvent
  tenant: TenantId
}): Promise<{ before: string; after: string; mode: string; maxChars: number }> {
  const output = turnEventToOrchestrationOutput(args.event)
  const userText = args.event.userMessage?.trim() || ''
  const before = args.event.assistantReply?.trim() || ''
  const { mode, reason } = resolveProseRouting(output, userText)

  if (output.relationshipToExistingModel.type === 'safety') {
    return {
      before,
      after: output.frontResponseDraft.trim(),
      mode,
      maxChars: 200,
    }
  }

  const digestPack = pickDeepModelDigestPack(await loadDeepModelDigest(args.tenant).catch(() => null))
  const prosePayload = buildDailyProsePayload(output, userText, { deepModelDigest: digestPack })
  const task = buildDailyProseTask(output, userText)

  const raw = await requireTextStream(combinedProseSystem(), task, prosePayload, undefined, {
    maxTokens: 1024,
    disableThinking: true,
  })
  const after = clampProse(raw, mode, { familyId: args.tenant.familyId, traceId: args.event.traceId })

  return {
    before,
    after,
    mode: `${mode} (${reason})`,
    maxChars: prosePayload.maxChars as number,
  }
}

/** 启发式 rubric（0–3），供 replay 报告 */
export function scoreProseHeuristic(args: {
  userText: string
  prose: string
  packFactCount: number
}): Record<string, number> {
  const { userText, prose, packFactCount } = args
  const p = prose.trim()
  const u = userText.trim()

  let archiveFit = 1
  if (packFactCount === 0) archiveFit = p.length > 20 ? 1 : 0
  else {
    const uTokens = [...new Set(u.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/).filter((t) => t.length >= 2))]
    const hits = uTokens.filter((t) => p.includes(t)).length
    if (hits >= 2) archiveFit = 3
    else if (hits >= 1) archiveFit = 2
    else if (/知道了|作业|手机|考试|学校|写/.test(p)) archiveFit = 2
    else archiveFit = 1
  }

  let directAnswer = 2
  if (/这里想区分|后面处理不一样|试完可能看到|最值得观察的对比点/.test(p)) directAnswer = 0
  else if (u.length < 8 && p.length < 40) directAnswer = 2
  else if (/\?|？/.test(p) && p.length < 80) directAnswer = 2
  else directAnswer = 2

  let continuity = 1
  if (/之前|上次|一贯|还是|又|这次/.test(p)) continuity = 2
  if (/之前|上次/.test(p) && /这次|更|新|不一样/.test(p)) continuity = 3

  let antiPattern = 3
  if (/这里想区分|后面处理不一样/.test(p)) antiPattern = 0
  else if (/随着.*不断发展|综上所述|希望对您有帮助|赋能|闭环/.test(p)) antiPattern = 1
  else if (/这你太熟了/.test(p)) antiPattern = 2

  let singleFocus = 2
  const sentenceCount = p.split(/[。！？!?]/).filter((s) => s.trim().length > 4).length
  if (sentenceCount <= 3 && p.length <= 220) singleFocus = 3
  else if (sentenceCount >= 6 || /首先|其次|另外|第一|第二/.test(p)) singleFocus = 0
  else if (sentenceCount >= 4) singleFocus = 1

  let plainLanguage = 2
  if (/启动困难|评价敏感|内驱力|自主权|机制链|homeostasis|模式对上了|卡的是|难的是/.test(p)) {
    plainLanguage = 0
  } else if (/属于.*那一类|概括|综上所述/.test(p)) plainLanguage = 1
  else if (p.length > 0 && p.length <= 200) plainLanguage = 3

  return { archiveFit, directAnswer, continuity, antiPattern, singleFocus, plainLanguage }
}

export function rubricTotal(scores: Record<string, number>): number {
  return (
    scores.archiveFit +
    scores.directAnswer +
    scores.continuity +
    scores.antiPattern +
    (scores.singleFocus ?? 0) +
    (scores.plainLanguage ?? 0)
  )
}

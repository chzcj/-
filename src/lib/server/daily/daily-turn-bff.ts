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
} from '@/lib/server/daily/parent-facing-copy'
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
  onDelta?: (delta: string) => void
}): Promise<DailyTurnBffResult> {
  const traceId = args.traceId || createId('trace')
  const userText = args.userText.trim()

  const output = await runOrchestrationPipeline({
    userText,
    maturityLevel: args.maturityLevel,
    tenant: args.tenant,
  })

  const isSafety = output.relationshipToExistingModel.type === 'safety'
  const linkedAreas = deriveLinkedAreas(userText)
  const cards = isSafety ? {} : buildDailyCards(output, userText)

  const proseMode = resolveProseMode(output)
  let finalText = await generateDailyProse(output, userText, args.onDelta)
  finalText = clampProse(finalText, proseMode)

  let sections = isSafety ? [] : composeDailySections(output, cards, userText)
  let llmSectionCopyUsed = false
  let taskTitleFromSections: string | undefined

  if (!isSafety && sections.length) {
    const filled = await fillDailySectionCopy(sections, output, userText)
    sections = filled.sections
    taskTitleFromSections = filled.taskTitle
    llmSectionCopyUsed = true
    sections = applySectionPolicy(sections, args.recentSectionIds || [], 4)
    finalText = dedupeProseFromSections(finalText, sections)
    finalText = clampProse(finalText, proseMode)
  }

  const actions = isSafety ? [] : composeDailyActions(output, cards, sections, finalText, taskTitleFromSections)
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
  }
}

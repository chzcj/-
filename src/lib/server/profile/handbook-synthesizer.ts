import 'server-only'

import { callFastJson, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { promptRegistry } from '@/lib/server/prompts/registry.generated'
import type { TenantId } from '@/lib/server/memory/tenant'
import { gatherHandbookContext } from '@/lib/server/profile/handbook-context'
import { loadWeeklyHandbook, saveWeeklyHandbook } from '@/lib/server/profile/handbook-store'
import type { WeeklyHandbook } from '@/types/handbook-pack'

function displaySystem(taskPrompt: string): string {
  return [
    promptRegistry.parentFacingStyle,
    promptRegistry.secondMeCollaboratorIdentity,
    taskPrompt,
  ].join('\n\n---\n\n')
}

function emptyHandbook(ctx: Awaited<ReturnType<typeof gatherHandbookContext>>): WeeklyHandbook {
  return {
    weekKey: ctx.weekKey,
    weekRangeLabel: ctx.weekRangeLabel,
    headline: '近7天还在积累记忆',
    coverBlurb: '完成交流或写一则随笔后，这里会收成可回看的近7天手账。',
    heroCopy: '近7天还没有足够记忆。交流、任务反馈或写随笔，都会慢慢厚起来。',
    highlight: '近7天记录还少，亮点会在更多交流后出现。',
    relationMoment: '关系里的值得记住的瞬间，会在您记录后出现。',
    compareLastWeek: ctx.previousWeekHandbook
      ? '继续记录，下次可以更好地对比上周。'
      : '这是手账的开始，继续交流会让对比更有意义。',
    refreshedAt: new Date().toISOString(),
    source: 'empty',
  }
}

export async function runWeeklyHandbookUpdate(tenant: TenantId): Promise<WeeklyHandbook | null> {
  const ctx = await gatherHandbookContext(tenant)
  const prev = await loadWeeklyHandbook(tenant, ctx.weekKey)

  if (prev?.source === 'llm' && (prev as WeeklyHandbook & { contentHash?: string }).contentHash === ctx.contentHash) {
    console.info('[weekly-handbook] skip LLM contentHash unchanged', ctx.weekKey)
    return prev
  }

  if (!ctx.materialThreshold.met) {
    const empty = emptyHandbook(ctx)
    if (prev?.source === 'llm') {
      console.info('[weekly-handbook] material insufficient, keep prev LLM snapshot')
      return prev
    }
    await saveWeeklyHandbook(tenant, empty)
    return empty
  }

  const llm = await callFastJson<{
    headline?: string
    coverBlurb?: string
    heroCopy?: string
    highlight?: string
    relationMoment?: string
    compareLastWeek?: string
    coverStory?: string
    weekInventory?: string[]
  }>(displaySystem(promptRegistry.weeklyHandbookSynthesizer), ctx, {
    maxTokens: 2048,
    disableThinking: frontAiThinkingDisabled(),
  }).catch(() => undefined)

  if (!llm?.headline?.trim()) {
    if (prev?.source === 'llm') return prev
    const fb = emptyHandbook(ctx)
    fb.source = 'fallback'
    await saveWeeklyHandbook(tenant, fb)
    return fb
  }

  const handbook: WeeklyHandbook & { contentHash?: string } = {
    weekKey: ctx.weekKey,
    weekRangeLabel: ctx.weekRangeLabel,
    headline: llm.headline.trim().slice(0, 24),
    coverBlurb: (llm.coverBlurb || '').trim().slice(0, 56),
    heroCopy: (llm.heroCopy || '').trim().slice(0, 80),
    highlight: (llm.highlight || '').trim().slice(0, 120),
    relationMoment: (llm.relationMoment || '').trim().slice(0, 120),
    compareLastWeek: (llm.compareLastWeek || '').trim().slice(0, 120),
    coverStory: llm.coverStory?.trim().slice(0, 120),
    weekInventory: Array.isArray(llm.weekInventory) ? llm.weekInventory.slice(0, 4) : undefined,
    refreshedAt: new Date().toISOString(),
    source: 'llm',
    contentHash: ctx.contentHash,
  }

  await saveWeeklyHandbook(tenant, handbook)
  return handbook
}

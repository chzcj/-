import 'server-only'

import { callFastJson, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { promptRegistry } from '@/lib/server/prompts/registry.generated'
import type { TenantId } from '@/lib/server/memory/tenant'
import { getGrowthTrajectorySnapshot } from '@/lib/server/memory/database-manager'
import { gatherHandbookContext } from '@/lib/server/profile/handbook-context'
import { loadTimeCapsuleSnapshot, saveTimeCapsuleSnapshot } from '@/lib/server/profile/handbook-store'
import { loadWeeklyHandbook } from '@/lib/server/profile/handbook-store'
import {
  formatRollingWindowRange,
  formatRollingWindowShort,
  getRollingWindowKey,
  previousRollingWindowKey,
} from '@/lib/server/profile/rolling-window'
import type { TimeCapsuleSnapshot } from '@/types/handbook-pack'

function displaySystem(taskPrompt: string): string {
  return [promptRegistry.parentFacingStyle, taskPrompt].join('\n\n---\n\n')
}

function buildPeriodLabels(thenWindowKey: string, nowWindowKey: string) {
  const thenRange = formatRollingWindowRange(thenWindowKey)
  const nowRange = formatRollingWindowRange(nowWindowKey)
  return {
    periodLabel: `对比 · ${formatRollingWindowShort(thenWindowKey)} vs ${formatRollingWindowShort(nowWindowKey)}`,
    thenLabel: `上次 · ${thenRange}`,
    nowLabel: `这次 · ${nowRange}`,
    thenWeekKey: thenWindowKey,
    nowWeekKey: nowWindowKey,
  }
}

export async function runTimeCapsuleUpdate(tenant: TenantId): Promise<TimeCapsuleSnapshot | null> {
  const ctx = await gatherHandbookContext(tenant)
  if (!ctx.materialThreshold.met) return loadTimeCapsuleSnapshot(tenant)

  const thenWeekKey = previousRollingWindowKey(ctx.weekKey)
  const labels = buildPeriodLabels(thenWeekKey, ctx.weekKey)

  const [trajectory, oldHandbook, currentHandbook] = await Promise.all([
    getGrowthTrajectorySnapshot(tenant),
    loadWeeklyHandbook(tenant, thenWeekKey),
    loadWeeklyHandbook(tenant, ctx.weekKey),
  ])

  const thenText =
    oldHandbook?.compareLastWeek ||
    oldHandbook?.headline ||
    trajectory?.entries?.slice(-1)[0]?.title ||
    '早期记录还少，对比会随着手账变厚而更清楚。'

  const nowText =
    currentHandbook?.headline ||
    ctx.previousWeekHandbook?.headline ||
    ctx.portraitDigestOneLiner ||
    '本周手账还在整理中。'

  const payload = {
    thenSnapshotRaw: thenText,
    nowSnapshotRaw: nowText,
    thenWeekLabel: labels.thenLabel,
    nowWeekLabel: labels.nowLabel,
    currentHandbook: ctx.feedItems,
    childQuotes: ctx.childQuotes,
  }

  const llm = await callFastJson<{
    teaserTitle?: string
    teaserSubtitle?: string
    thenSnapshot?: string
    nowSnapshot?: string
    thenQuote?: string
    relationShift?: string
  }>(displaySystem(promptRegistry.timeCapsuleCompare), payload, {
    maxTokens: 1536,
    disableThinking: frontAiThinkingDisabled(),
  }).catch(() => undefined)

  if (!llm?.thenSnapshot?.trim() && !llm?.teaserTitle?.trim()) {
    return loadTimeCapsuleSnapshot(tenant)
  }

  const teaserTitle = (llm.teaserTitle || llm.thenSnapshot || thenText).trim().slice(0, 28)
  const teaserSubtitle = (llm.teaserSubtitle || llm.nowSnapshot || nowText).trim().slice(0, 56)

  const snap: TimeCapsuleSnapshot = {
    ...labels,
    teaserTitle,
    teaserSubtitle,
    thenSnapshot: (llm.thenSnapshot || thenText).trim().slice(0, 220),
    nowSnapshot: (llm.nowSnapshot || nowText).trim().slice(0, 220),
    thenQuote: llm.thenQuote?.trim().slice(0, 80),
    relationShift: llm.relationShift?.trim().slice(0, 80),
    refreshedAt: new Date().toISOString(),
  }

  await saveTimeCapsuleSnapshot(tenant, snap)
  return snap
}

export { timeCapsuleToTeaser } from '@/types/handbook-pack'

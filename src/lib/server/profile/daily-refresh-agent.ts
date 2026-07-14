import 'server-only'

import { callFastJson } from '@/lib/server/ark-agents'
import { promptRegistry } from '@/lib/server/prompts/registry.generated'
import { loadMemoryLayerItemById, upsertMemoryLayerItems } from '@/lib/server/db'
import {
  getFamilyInteractionCycles,
  getLatestBuiltProfileSnapshot,
  getLatestEvidenceNetwork,
  getMergedParentInputHistory,
  getPendingHypotheses,
} from '@/lib/server/memory/database-manager'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { DailyThinkingChip } from '@/types/daily-message'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { isPlaceholderProfileText } from '@/lib/server/daily/profile-sanitize'
import { pickDeepModelDigestPack, type DeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { enrichPortraitCards } from '@/lib/server/profile/portrait-card-enrich'
import type { DailyPortraitCards } from '@/types/portrait-card'
import { truncateSummary } from '@/types/portrait-card'

const LAYER = 'daily_ui_snapshot'
const ITEM_ID = 'latest'

export type { DailyPortraitCards }

export type DailyUiSnapshot = {
  thinkingChips: DailyThinkingChip[]
  portraitCards: DailyPortraitCards
  refreshedAt: string
  source: 'llm' | 'fallback'
}

export async function loadDailyUiSnapshot(tenant: TenantId): Promise<DailyUiSnapshot | null> {
  const item = await loadMemoryLayerItemById<DailyUiSnapshot>(
    LAYER,
    ITEM_ID,
    tenant.familyId,
    tenant.childId
  ).catch(() => undefined)
  return item ?? null
}

function truncate(text: string, max = 36): string {
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max).replace(/[，,。：:；;]$/, '')}…`
}

/** 无 LLM 兜底：直接从结构化字段拼真实人话，禁止模板假文案。 */
function buildFallbackSnapshot(ctx: RefreshContext, digestPack: DeepModelDigestPack): DailyUiSnapshot {
  const built = ctx.built
  const core = isPlaceholderProfileText(built?.coreJudgment) ? '' : (built?.coreJudgment?.trim() || '')
  const support = isPlaceholderProfileText(built?.supportFocus) ? '' : (built?.supportFocus?.trim() || '')
  const topMechanism = ctx.topMechanisms[0] || ''
  const cycleText = ctx.topCycle || ''
  const hypText = ctx.activeHypotheses[0] || ''
  const recentText = ctx.recentInputs[0] || ''

  const chips: DailyThinkingChip[] = [
    { label: '当前理解', text: core ? truncate(core, 32) : '还在了解' },
    { label: '高频场景', text: support ? truncate(support, 32) : topMechanism ? truncate(topMechanism, 32) : '还在了解' },
    { label: '学习特点', text: core ? truncate(core, 32) : '还在了解' },
    { label: '互动特点', text: cycleText ? truncate(cycleText, 32) : '还在了解' },
  ]

  const mk = (summarySrc: string, leadSrc?: string) => {
    const lead = (leadSrc || summarySrc).trim()
    if (!lead) return { summary: '还在了解' }
    return { summary: truncateSummary(lead), lead }
  }

  const portraitCards: DailyPortraitCards = {
    growth: mk(core || digestPack.mechanismNarrative),
    focus: mk(support || digestPack.cultivationFocus),
    behavior: mk(topMechanism || digestPack.anchoredFacts[0] || ''),
    interaction: mk(cycleText || digestPack.interactionLoops[0] || ''),
    strategies: mk(support || digestPack.cultivationFocus),
    hypotheses: mk(hypText || digestPack.openHypotheses[0] || ''),
  }

  return {
    thinkingChips: chips,
    portraitCards,
    refreshedAt: new Date().toISOString(),
    source: 'fallback',
    // 保留最近一条家长原话供调试（不展示）
    recentInput: recentText ? truncate(recentText, 24) : undefined,
  } as DailyUiSnapshot
}

type RefreshContext = {
  built: Awaited<ReturnType<typeof getLatestBuiltProfileSnapshot>>
  topMechanisms: string[]
  topCycle: string
  activeHypotheses: string[]
  recentInputs: string[]
}

async function gatherRefreshContext(tenant: TenantId): Promise<RefreshContext> {
  const [built, network, cycles, hypotheses, history] = await Promise.all([
    getLatestBuiltProfileSnapshot(tenant).catch(() => null),
    getLatestEvidenceNetwork(tenant).catch(() => null),
    getFamilyInteractionCycles(tenant).catch(() => []),
    getPendingHypotheses(tenant).catch(() => []),
    getMergedParentInputHistory(tenant, 5).catch(() => []),
  ])

  const topMechanisms =
    network?.candidateMechanismMatrix
      ?.filter((m) => m.mechanismName && m.overallStrength !== 'low')
      .slice(0, 5)
      .map((m) => truncate(m.description || m.mechanismName, 60)) || []

  const topCycle = cycles[0]
    ? truncate(`${cycles[0].cycleName}：${cycles[0].childReaction || cycles[0].childReception || ''}`, 60)
    : ''

  const activeHypotheses = hypotheses
    .filter((h) => h.status === 'pending' || h.status === 'supported')
    .slice(0, 2)
    .map((h) => truncate(h.hypothesis, 60))

  const recentInputs = history.map((h) => h.text).filter(Boolean)

  return { built, topMechanisms, topCycle, activeHypotheses, recentInputs }
}

/**
 * 登录时把后台记忆库结构化信息转成家长可读的 Thinking 四宫格 + 画像 Tab 卡片摘要。
 * LLM 优先；失败则用真实字段兜底（不写假模板）。结果落 daily_ui_snapshot 层供 hub 读取。
 */
export async function runDailyPortraitRefresh(tenant: TenantId): Promise<DailyUiSnapshot> {
  const ctx = await gatherRefreshContext(tenant)
  const digest = await buildDeepModelDigest(tenant).catch(() => null)
  const digestPack = pickDeepModelDigestPack(digest)

  const payload = {
    coreJudgment: isPlaceholderProfileText(ctx.built?.coreJudgment) ? '' : (ctx.built?.coreJudgment || ''),
    supportFocus: isPlaceholderProfileText(ctx.built?.supportFocus) ? '' : (ctx.built?.supportFocus || ''),
    completeness: ctx.built?.completeness ?? 0,
    topMechanisms: ctx.topMechanisms,
    familyInteractionCycle: ctx.topCycle,
    pendingHypotheses: ctx.activeHypotheses,
    recentParentInputs: ctx.recentInputs,
    deepModelDigest: digestPack,
    requireFactAnchor: true,
  }

  const llmResult = await callFastJson<{
    thinkingChips: DailyThinkingChip[]
    portraitCards: DailyPortraitCards
  }>(promptRegistry.dailyPortraitRefresh, payload, { maxTokens: 512 }).catch(() => undefined)

  const snapshot: DailyUiSnapshot =
    llmResult && Array.isArray(llmResult.thinkingChips) && llmResult.thinkingChips.length > 0
      ? {
          thinkingChips: llmResult.thinkingChips.slice(0, 4),
          portraitCards: llmResult.portraitCards || {},
          refreshedAt: new Date().toISOString(),
          source: 'llm',
        }
      : buildFallbackSnapshot(ctx, digestPack)

  snapshot.portraitCards = enrichPortraitCards(snapshot.portraitCards, digestPack, {
    coreJudgment: isPlaceholderProfileText(ctx.built?.coreJudgment) ? undefined : ctx.built?.coreJudgment,
    supportFocus: isPlaceholderProfileText(ctx.built?.supportFocus) ? undefined : ctx.built?.supportFocus,
  })

  await upsertMemoryLayerItems(
    LAYER,
    [{ itemId: ITEM_ID, familyId: tenant.familyId, childId: tenant.childId, data: snapshot }],
    tenant.familyId,
    tenant.childId
  ).catch((err) => {
    console.error('[daily-refresh] 写入 daily_ui_snapshot 失败:', err)
  })

  return snapshot
}

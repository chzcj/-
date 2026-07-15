import 'server-only'

import { callFastJson, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
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
import {
  formatMatchedMechanismCards,
  pickDeepModelDigestPack,
  type DeepModelDigestPack,
} from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { enrichPortraitCards } from '@/lib/server/profile/portrait-card-enrich'
import type { DailyPortraitCards } from '@/types/portrait-card'
import { truncateSummary } from '@/types/portrait-card'

const LAYER = 'daily_ui_snapshot'
const ITEM_ID = 'latest'

export type { DailyPortraitCards }

export type DailyUiSnapshot = {
  thinkingChips: DailyThinkingChip[]
  portraitCards: DailyPortraitCards
  /** 孩子近期的闪光点（展示层） */
  highlights?: string[]
  refreshedAt: string
  source: 'llm' | 'fallback'
}

function displaySystem(taskPrompt: string): string {
  return [
    promptRegistry.parentFacingStyle,
    promptRegistry.secondMeCollaboratorIdentity,
    promptRegistry.deepModelingParentDigest,
    taskPrompt,
  ].join('\n\n---\n\n')
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

function normalizeHighlights(raw: unknown, prev?: string[]): string[] {
  const fromLlm = Array.isArray(raw)
    ? raw
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 48))
        .slice(0, 5)
    : []
  if (fromLlm.length) return fromLlm
  return (prev || []).slice(0, 5)
}

/** 无 LLM 兜底：真实字段拼人话，禁止假模板。 */
function buildFallbackSnapshot(ctx: RefreshContext, digestPack: DeepModelDigestPack): DailyUiSnapshot {
  const built = ctx.built
  const core = isPlaceholderProfileText(built?.coreJudgment) ? '' : (built?.coreJudgment?.trim() || '')
  const support = isPlaceholderProfileText(built?.supportFocus) ? '' : (built?.supportFocus?.trim() || '')
  const topMechanism = ctx.topMechanisms[0] || ''
  const cycleText = ctx.familyCycles[0] || ''
  const hypText = ctx.activeHypotheses[0] || ''

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

  const tensionText = digestPack.structuralTensions[0] || cycleText || ''

  const portraitCards: DailyPortraitCards = {
    growth: mk(core || digestPack.mechanismNarrative),
    focus: mk(support || digestPack.cultivationFocus),
    behavior: mk(topMechanism || digestPack.anchoredFacts[0] || ''),
    interaction: mk(cycleText || digestPack.interactionLoops[0] || ''),
    strategies: mk(support || digestPack.cultivationFocus),
    hypotheses: mk(hypText || digestPack.openHypotheses[0] || ''),
    tensions: mk(tensionText),
  }

  const highlights = digestPack.anchoredFacts
    .filter((f) => /会|能|主动|进步|愿意|好|亮|坚持/.test(f))
    .slice(0, 3)

  return {
    thinkingChips: chips,
    portraitCards,
    highlights: highlights.length ? highlights : undefined,
    refreshedAt: new Date().toISOString(),
    source: 'fallback',
  }
}

type RefreshContext = {
  built: Awaited<ReturnType<typeof getLatestBuiltProfileSnapshot>>
  topMechanisms: string[]
  familyCycles: string[]
  activeHypotheses: string[]
  recentInputs: string[]
  builtEvidence: Array<{ sourceLabel: string; evidenceText: string; explanation?: string }>
  builtVerification: Array<{ title: string; description: string }>
  builtDeepMechanism: string
}

/** 厚喂料：禁止保守切片——多给机制/循环/假设/原话。 */
async function gatherRefreshContext(tenant: TenantId): Promise<RefreshContext> {
  const [built, network, cycles, hypotheses, history] = await Promise.all([
    getLatestBuiltProfileSnapshot(tenant).catch(() => null),
    getLatestEvidenceNetwork(tenant).catch(() => null),
    getFamilyInteractionCycles(tenant).catch(() => []),
    getPendingHypotheses(tenant).catch(() => []),
    getMergedParentInputHistory(tenant, 30).catch(() => []),
  ])

  const matrix = network?.candidateMechanismMatrix || []
  const fromCards = formatMatchedMechanismCards(matrix).slice(0, 20)
  const topMechanisms =
    fromCards.length > 0
      ? fromCards
      : matrix
          .filter((m) => m.mechanismName)
          .slice(0, 20)
          .map((m) => truncate(`${m.mechanismName}：${m.description || ''}`, 180))

  const familyCycles = cycles.slice(0, 10).map((c) =>
    truncate(
      `${c.cycleName}：家长侧 ${c.parentTriggerAction || ''} → 孩子 ${c.childReaction || ''}`,
      160
    )
  )

  const activeHypotheses = hypotheses
    .filter((h) => h.status === 'pending' || h.status === 'supported' || h.status === 'weakened')
    .slice(0, 12)
    .map((h) => truncate(h.hypothesis, 120))

  const recentInputs = history
    .map((h) => h.text)
    .filter(Boolean)
    .map((t) => truncate(t, 200))
    .slice(0, 30)

  const builtEvidence = (built?.evidence || [])
    .filter((e) => e.evidenceText?.trim())
    .slice(0, 12)
    .map((e) => ({
      sourceLabel: e.sourceLabel || '依据',
      evidenceText: truncate(e.evidenceText, 200),
      explanation: e.explanation ? truncate(e.explanation, 120) : undefined,
    }))

  const builtVerification = (built?.verificationPoints || [])
    .filter((v) => v.title?.trim())
    .slice(0, 8)
    .map((v) => ({
      title: truncate(v.title, 40),
      description: truncate(v.description || '', 160),
    }))

  return {
    built,
    topMechanisms,
    familyCycles,
    activeHypotheses,
    recentInputs,
    builtEvidence,
    builtVerification,
    builtDeepMechanism: (built?.deepMechanism || '').trim().slice(0, 800),
  }
}

/**
 * 进画像 Tab / 登录刷新：厚喂料 + Agent A 写 portraitCards/highlights。
 */
export async function runDailyPortraitRefresh(tenant: TenantId): Promise<DailyUiSnapshot> {
  const prev = await loadDailyUiSnapshot(tenant).catch(() => null)
  const ctx = await gatherRefreshContext(tenant)
  const digest = await buildDeepModelDigest(tenant).catch(() => null)
  const digestPack = pickDeepModelDigestPack(digest, { forceThick: true })

  const payload = {
    coreJudgment: isPlaceholderProfileText(ctx.built?.coreJudgment) ? '' : (ctx.built?.coreJudgment || ''),
    supportFocus: isPlaceholderProfileText(ctx.built?.supportFocus) ? '' : (ctx.built?.supportFocus || ''),
    completeness: ctx.built?.completeness ?? 0,
    builtDeepMechanism: ctx.builtDeepMechanism,
    builtEvidence: ctx.builtEvidence,
    builtVerificationPoints: ctx.builtVerification,
    topMechanisms: ctx.topMechanisms,
    familyInteractionCycles: ctx.familyCycles,
    familyInteractionCycle: ctx.familyCycles[0] || '',
    pendingHypotheses: ctx.activeHypotheses,
    recentParentInputs: ctx.recentInputs,
    deepModelDigest: digestPack,
    structuralTensionsRaw: digestPack.structuralTensions,
    feedNote: '材料已尽量给全（厚包）。请综合六维写画像，禁止只盯最近一条作业场景。',
    requireFactAnchor: true,
  }

  const llmCards = await callFastJson<{
    thinkingChips: DailyThinkingChip[]
    portraitCards: DailyPortraitCards
    highlights?: string[]
  }>(displaySystem(promptRegistry.dailyPortraitRefresh), payload, {
    maxTokens: 6144,
    disableThinking: frontAiThinkingDisabled(),
  }).catch(() => undefined)

  const snapshot: DailyUiSnapshot =
    llmCards && Array.isArray(llmCards.thinkingChips) && llmCards.thinkingChips.length > 0
      ? {
          thinkingChips: llmCards.thinkingChips.slice(0, 4),
          portraitCards: llmCards.portraitCards || {},
          highlights: normalizeHighlights(llmCards.highlights, prev?.highlights),
          refreshedAt: new Date().toISOString(),
          source: 'llm',
        }
      : (() => {
          const fb = buildFallbackSnapshot(ctx, digestPack)
          return {
            ...fb,
            highlights: normalizeHighlights(undefined, prev?.highlights).length
              ? normalizeHighlights(undefined, prev?.highlights)
              : fb.highlights,
          }
        })()

  snapshot.portraitCards = enrichPortraitCards(snapshot.portraitCards, digestPack, {
    coreJudgment: isPlaceholderProfileText(ctx.built?.coreJudgment) ? undefined : ctx.built?.coreJudgment,
    supportFocus: isPlaceholderProfileText(ctx.built?.supportFocus) ? undefined : ctx.built?.supportFocus,
    preferLlm: snapshot.source === 'llm',
  })

  if (!snapshot.highlights?.length && prev?.highlights?.length) {
    snapshot.highlights = prev.highlights
  }

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

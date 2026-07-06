import { ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import {
  getLatestBuiltProfileSnapshot,
  getLatestEvidenceNetwork,
  getFamilyInteractionCycles,
  getPendingHypotheses,
  getBuildProgress,
} from '@/lib/server/memory/database-manager'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { humanizeEntryRef } from '@/lib/entry-name-i18n'
import { isProfilePlaceholderText } from '@/lib/profile/placeholder-text'
import { loadDailyUiSnapshot } from '@/lib/server/profile/daily-refresh-agent'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { enrichPortraitCards } from '@/lib/server/profile/portrait-card-enrich'

function truncate(text: string, max = 160) {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).replace(/[，,；;：:]$/, '')}…`
}

/** 命中占位/状态文案（如"从服务器记录恢复"）或为空 → 视为没有真实深度分析。 */
function isPlaceholderCore(text: string): boolean {
  return isProfilePlaceholderText(text)
}

/**
 * 新用户刚跑完四模块、但首次 synthesis 还没产出真实 coreJudgment 时，
 * 直接用各模块阶段总结拼一段"过渡分析"，让画像页不至于显示无意义占位文案。
 */
function composeTransitionFromStageSummaries(
  stageSummaries: Array<{ entryType: string; mainJudgment: string; facts?: string[] }>
): string {
  const meaningful = stageSummaries.filter((s) => s.mainJudgment && s.mainJudgment.trim())
  if (meaningful.length === 0) return ''
  const lines = meaningful.map((s) => {
    const name = humanizeEntryRef(s.entryType) || s.entryType
    const head = truncate(s.mainJudgment, 90)
    return `· ${name}：${head}`
  })
  return `基于你刚完成的四模块，目前初步看到：\n${lines.join('\n')}\n继续交流会让这层分析越来越聚焦。`
}

/** 画像 Tab 数据中心：从真实记忆层组装卡片文案 */
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const tenant = await resolveTenant()
  const [built, network, cycles, hypotheses, progress, uiSnapshot] = await Promise.all([
    getLatestBuiltProfileSnapshot(tenant).catch(() => null),
    getLatestEvidenceNetwork(tenant).catch(() => null),
    getFamilyInteractionCycles(tenant).catch(() => []),
    getPendingHypotheses(tenant).catch(() => []),
    getBuildProgress(tenant).catch(() => null),
    loadDailyUiSnapshot(tenant).catch(() => null),
  ])

  let coreJudgment = built?.coreJudgment?.trim() || ''
  let supportFocus = built?.supportFocus?.trim() || ''

  // coreJudgment 是占位/空 → 用四模块阶段总结拼一段过渡分析兜底
  if (isPlaceholderCore(coreJudgment)) {
    const transition = composeTransitionFromStageSummaries(progress?.stageSummaries || [])
    if (transition) coreJudgment = transition
    else coreJudgment = ''
  }
  if (isPlaceholderCore(supportFocus)) supportFocus = ''

  const topMechanisms =
    network?.candidateMechanismMatrix
      ?.filter((m) => m.mechanismName)
      .slice(0, 2)
      .map((m) => truncate(m.description || m.mechanismName, 100)) || []

  const topCycle = cycles[0]
  const interactionText = topCycle
    ? truncate(
        `${topCycle.cycleName}：${topCycle.childReaction || topCycle.childReception || ''}`,
        140
      )
    : ''

  const activeHyps = hypotheses
    .filter((h) => h.status === 'pending' || h.status === 'supported')
    .slice(0, 2)
    .map((h) => truncate(h.hypothesis, 100))

  const strategies = supportFocus
    ? truncate(supportFocus, 120)
    : topMechanisms[0] || ''

  let digest = await loadDeepModelDigest(tenant).catch(() => null)
  if (!digest?.mechanismNarrative) {
    digest = await buildDeepModelDigest(tenant).catch(() => digest)
  }
  const digestPack = pickDeepModelDigestPack(digest)
  const portraitCards = uiSnapshot?.portraitCards
    ? enrichPortraitCards(uiSnapshot.portraitCards, digestPack, { coreJudgment, supportFocus })
    : undefined

  return ok({
    coreJudgment,
    completeness: built?.completeness ?? 0,
    supportFocus,
    behaviorSummary: coreJudgment ? truncate(coreJudgment, 120) : topMechanisms[0] || '',
    interactionPattern: interactionText,
    effectiveStrategies: strategies,
    pendingHypotheses: activeHyps.join('；') || '',
    pendingHypothesesList: activeHyps,
    structuralTensions: digest?.structuralTensions || [],
    hasRealData: Boolean(coreJudgment || interactionText || activeHyps.length),
    // 来自 daily-refresh Agent 的人话展示层（登录时刷新，落 daily_ui_snapshot）
    thinkingChips: uiSnapshot?.thinkingChips,
    portraitCards,
    refreshedAt: uiSnapshot?.refreshedAt || null,
  })
}

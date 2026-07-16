import { apiRequest } from '@/services/api'
import type { DailyTurn } from '@/services/dailyStream'
import {
  BUILD_MODULES,
  loadBuildState,
  type BuildEntryType,
  type BuildState,
} from '@/services/buildState'
import { computeBuildCompletenessV2 } from '@/lib/buildCompleteness'

export type BuiltSnapshotInput = {
  completeness: number
  coreJudgment: string
  deepMechanism: string
  supportFocus?: string
  evidence?: Array<{
    sourceLabel: string
    evidenceText: string
    explanation: string
    strength: 'weak' | 'medium' | 'strong'
  }>
  verificationPoints?: Array<{ title: string; description: string }>
}

function mapStrength(s: string | undefined): 'weak' | 'medium' | 'strong' {
  if (s === 'weak') return 'weak'
  if (s === 'strong') return 'strong'
  return 'medium'
}

export function buildEntryMapFromState(state: BuildState) {
  const entryMap: Record<
    string,
    {
      rawTexts: string[]
      followUps: string[]
      stageSummary?: string
      aiFacts?: string[]
      aiHypotheses?: string[]
    }
  > = {}
  for (const mod of BUILD_MODULES) {
    const m = state.entryMap[mod.key]
    entryMap[mod.key] = {
      rawTexts: m?.rawTexts || [],
      followUps: m?.followUps || [],
      stageSummary: m?.stageSummary,
      aiFacts: m?.aiFacts,
      aiHypotheses: m?.aiHypotheses,
    }
  }
  return entryMap
}

export function completedEntryCount(state: BuildState): number {
  return BUILD_MODULES.filter((mod) => Boolean(state.entryMap[mod.key]?.moduleComplete)).length
}

/** 质量有效模块数（信息不足的确认模块不计入） */
export function qualityValidEntryCount(state: BuildState): number {
  return computeCompletenessFromState(state).qualityValidCount
}

export function computeCompletenessFromState(state: BuildState) {
  return computeBuildCompletenessV2(
    BUILD_MODULES.map((mod) => {
      const m = state.entryMap[mod.key]
      return {
      confirmed: Boolean(m?.moduleComplete),
      mainJudgment: m?.stageSummary || '',
      facts: m?.aiFacts || [],
      sufficient: m?.summarySufficient,
    }
    })
  )
}

export function buildSnapshotFromResults(
  syn: Record<string, unknown>,
  diag: Record<string, unknown>,
  state: BuildState
): BuiltSnapshotInput {
  const evidencePaths: BuiltSnapshotInput['evidence'] = []
  const seenEvidence = new Set<string>()

  for (const cm of (syn.candidateMechanismMatrix as Array<Record<string, unknown>>) || []) {
    const evidenceText = ((cm.supportingEvidence as string[]) || []).slice(0, 2).join('；')
    if (!evidenceText || seenEvidence.has(evidenceText)) continue
    seenEvidence.add(evidenceText)
    evidencePaths.push({
      sourceLabel: `候选机制：${String(cm.mechanismName || '')}`,
      evidenceText,
      explanation: String(cm.applicableScope || cm.description || ''),
      strength: mapStrength(String(cm.overallStrength || '')),
    })
  }

  for (const ev of (syn.crossEntryEvidenceMap as Array<Record<string, unknown>>) || []) {
    const src = ((ev.sourceEntries as string[]) || ['多模块']).join('+')
    const fact = String(
      (ev.surfaceBehaviors as string[])?.[0] || (ev.childReactions as string[])?.[0] || ''
    )
    if (!fact || seenEvidence.has(fact)) continue
    seenEvidence.add(fact)
    evidencePaths.push({
      sourceLabel: `${src} · 跨场景`,
      evidenceText: fact,
      explanation: String(ev.possibleSharedFunction || ''),
      strength: mapStrength(String(ev.evidenceStrength || '')),
    })
  }

  const profileText =
    [
      (diag.secondMeConditionalProfile as string[])?.[0],
      diag.parentMisjudgmentCorrection as string,
    ]
      .filter(Boolean)
      .join('\n\n') || '暂时无法生成稳定画像，建议补充更多模块信息。'

  const chain = diag.primaryMechanismChain as Record<string, string> | undefined
  const mechanismText = chain?.parentAction
    ? [
        `家长常见动作：${chain.parentAction}`,
        `孩子可能接收成：${chain.childReception}`,
        `孩子保护策略：${chain.childProtectionStrategy}`,
        `家长二次解读：${chain.parentSecondInterpretation}`,
        `强化循环：${chain.reinforcingAction}`,
        `短期功能：${chain.shortTermFunction}`,
        `长期代价：${chain.longTermCost}`,
      ].join('\n')
    : ''

  const protectionList =
  ((diag.childSelfProtection as { protectingWhat?: string[] })?.protectingWhat) || []

  const { completeness } = computeCompletenessFromState(state)

  return {
    completeness,
    coreJudgment: profileText,
    deepMechanism: mechanismText,
    supportFocus:
      protectionList.length > 0
        ? `保护策略：${protectionList.join('、')}；验证点：${((diag.needsFurtherVerification as string[]) || []).join('；')}`
        : undefined,
    evidence: evidencePaths.length > 0 ? evidencePaths : undefined,
    verificationPoints: ((diag.needsFurtherVerification as string[]) || []).map((v) => ({
      title: '待验证',
      description: v,
    })),
  }
}

export async function runProfileGeneratingPipeline(
  onStep: (step: number, label: string) => void
): Promise<{ ok: true } | { ok: false; message: string }> {
  const build = loadBuildState()
  const entryMap = buildEntryMapFromState(build)
  const completed = completedEntryCount(build)
  const qualityValid = qualityValidEntryCount(build)
  const maturityLevel = qualityValid >= 4 ? 'L2' : qualityValid >= 2 ? 'L1' : completed >= 1 ? 'L0' : 'L0'

  onStep(1, '跨模块综合建模…')
  const synRes = await apiRequest<{ synthesis?: Record<string, unknown> }>('/api/synthesis', {
    method: 'POST',
    data: {
      entryMap,
      crossCuttingSupplement: build.finalFollowUpText || '',
      maturityLevel,
    },
  })
  if (!synRes.ok) return { ok: false, message: synRes.error.message || '综合建模失败' }
  const syn = synRes.data.synthesis || {}

  onStep(2, '深度诊断与机制复核…')
  const diagRes = await apiRequest<{ diagnosis?: Record<string, unknown> }>('/api/diagnosis', {
    method: 'POST',
    data: {
      taskType: 'profile_build',
      maturityLevel: (syn.contextMaturityLevel as string) || maturityLevel,
      surfaceProblem:
        ((syn.candidateMechanismMatrix as Array<{ mechanismName?: string }>) || [])[0]
          ?.mechanismName || '',
      parentSurfaceJudgment: '',
      facts: ((syn.candidateMechanismMatrix as Array<{ supportingEvidence?: string[] }>) || []).flatMap(
        (m) => m.supportingEvidence || []
      ),
      childQuotes: [],
      parentQuotes: [],
      synthesisOutput: syn,
    },
  })
  if (!diagRes.ok) return { ok: false, message: diagRes.error.message || '深度诊断失败' }
  const diag = diagRes.data.diagnosis || {}

  onStep(3, '保存孩子画像…')
  const snapshot = buildSnapshotFromResults(syn, diag, build)

  let persisted = false
  for (let attempt = 0; attempt < 3; attempt++) {
    const persistRes = await apiRequest<{ saved?: boolean; onboardingComplete?: boolean }>(
      '/api/profile/built',
      { method: 'POST', data: { snapshot } }
    )
    if (persistRes.ok && persistRes.data.saved) {
      persisted = true
      break
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 800))
  }
  if (!persisted) {
    return { ok: false, message: '画像已生成，但未能保存，请检查网络后重试' }
  }

  const { hydrateProfileFromRemote } = await import('@/services/profileStorage')
  hydrateProfileFromRemote({
    coreJudgment: snapshot.coreJudgment,
    completeness: snapshot.completeness,
    supportFocus: snapshot.supportFocus,
    deepMechanism: snapshot.deepMechanism,
    evidence: snapshot.evidence,
    verificationPoints: snapshot.verificationPoints,
  })

  const { forceAccountSyncToServer } = await import('@/services/accountSync')
  await forceAccountSyncToServer()

  onStep(4, '整理首版画像…')
  await waitForProfileReadiness()

  return { ok: true }
}

export async function waitForProfileReadiness(): Promise<void> {
  // 画像正文已由 synthesis + diagnosis 完整生成。三件套未就绪时仍可进入结果，
  // 深度机制复核在后台继续，避免把 4 步长 Job 的墙钟时间加到新用户首屏等待上。
  const MAX_TRIES = 6
  const INTERVAL = 2500
  for (let i = 0; i < MAX_TRIES; i++) {
    const res = await apiRequest<{ ready?: boolean }>('/api/profile/readiness', { method: 'GET' })
    if (res.ok && res.data.ready) return
    await new Promise((r) => setTimeout(r, INTERVAL))
  }
}

export async function hydrateDailyThreadFromServer(): Promise<DailyTurn[]> {
  const { loadDailyThread, saveDailyThread } = await import('@/services/dailyStream')
  const res = await apiRequest<{ turns?: DailyTurn[] }>('/api/daily/thread?limit=30', {
    method: 'GET',
  })
  if (res.ok && Array.isArray(res.data.turns) && res.data.turns.length > 0) {
    saveDailyThread(res.data.turns)
    return res.data.turns
  }
  return loadDailyThread()
}

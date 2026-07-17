import Taro from '@tarojs/taro'
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

export type ProfileBuildRunState = {
  runId?: string
  buildVersion: string
  status: 'idle' | 'pending' | 'running' | 'succeeded' | 'failed'
  phase: number
  label: string
  startedAt?: string
  updatedAt: string
  error?: string
  failedStage?: string
  firstVisibleSnapshotReady?: boolean
}

type ServerBuildRun = {
  runId: string
  inputVersion: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  phase: number
  label: string
  error?: string
  failedStage?: string
  startedAt?: string
  updatedAt?: string
}

const PROFILE_BUILD_RUN_KEY = 'yujian_profile_build_run'
const POLL_INTERVAL_MS = 2000
let activeProfileBuildPromise: Promise<{ ok: true } | { ok: false; message: string }> | null = null
const profileBuildRunListeners = new Set<(state: ProfileBuildRunState) => void>()

function makeBuildVersion(state: BuildState): string {
  const input = [
    state.finalFollowUpText || '',
    ...BUILD_MODULES.flatMap((mod) => {
      const value = state.entryMap[mod.key]
      return [...(value?.rawTexts || []), ...(value?.followUps || []), value?.stageSummary || '']
    }),
  ].join('\u0001')
  let hash = 0
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) | 0
  return `${Math.abs(hash)}-${input.length}`
}

function mapServerRun(
  run: ServerBuildRun | null | undefined,
  fallbackVersion: string,
  firstVisibleSnapshotReady?: boolean
): ProfileBuildRunState | null {
  if (!run) return null
  return {
    runId: run.runId,
    buildVersion: run.inputVersion || fallbackVersion,
    status: run.status,
    phase: run.phase,
    label: run.label,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt || new Date().toISOString(),
    error: run.error,
    failedStage: run.failedStage,
    firstVisibleSnapshotReady,
  }
}

export function getProfileBuildRunState(): ProfileBuildRunState | null {
  try {
    const raw = Taro.getStorageSync(PROFILE_BUILD_RUN_KEY)
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed?.buildVersion || !parsed?.status) return null
    return parsed as ProfileBuildRunState
  } catch {
    return null
  }
}

function saveProfileBuildRunState(state: ProfileBuildRunState) {
  try {
    Taro.setStorageSync(PROFILE_BUILD_RUN_KEY, JSON.stringify(state))
  } catch {
    /* 本地运行提示丢失不影响原画像流程 */
  }
  for (const listener of profileBuildRunListeners) listener(state)
}

export function subscribeProfileBuildRun(listener: (state: ProfileBuildRunState) => void) {
  profileBuildRunListeners.add(listener)
  const current = getProfileBuildRunState()
  if (current) listener(current)
  return () => {
    profileBuildRunListeners.delete(listener)
  }
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
      moduleComplete?: boolean
      summarySufficient?: boolean
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
      moduleComplete: m?.moduleComplete,
      summarySufficient: m?.summarySufficient,
    }
  }
  return entryMap
}

export function completedEntryCount(state: BuildState): number {
  return BUILD_MODULES.filter((mod) => Boolean(state.entryMap[mod.key]?.moduleComplete)).length
}

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

async function hydrateBuiltSnapshotFromServer() {
  const built = await apiRequest<{
    snapshot?: BuiltSnapshotInput
  }>('/api/profile/built', { method: 'GET' })
  if (!built.ok || !built.data.snapshot?.coreJudgment) return
  const snapshot = built.data.snapshot
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
}

export async function fetchServerBuildRun(): Promise<ProfileBuildRunState | null> {
  const build = loadBuildState()
  const fallbackVersion = makeBuildVersion(build)
  const res = await apiRequest<{
    run?: ServerBuildRun | null
    firstVisibleSnapshotReady?: boolean
  }>('/api/profile/build-run', { method: 'GET' })
  if (!res.ok) return getProfileBuildRunState()
  const mapped = mapServerRun(res.data.run, fallbackVersion, res.data.firstVisibleSnapshotReady)
  if (mapped) saveProfileBuildRunState(mapped)
  return mapped
}

export async function startServerProfileBuildRun(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const build = loadBuildState()
  const entryMap = buildEntryMapFromState(build)
  const res = await apiRequest<{
    run?: ServerBuildRun
    firstVisibleSnapshotReady?: boolean
  }>('/api/profile/build-run', {
    method: 'POST',
    data: {
      entryMap,
      finalFollowUpText: build.finalFollowUpText || '',
    },
  })
  if (!res.ok) {
    return { ok: false, message: res.error.message || '无法启动画像整理' }
  }
  const mapped = mapServerRun(res.data.run, makeBuildVersion(build), res.data.firstVisibleSnapshotReady)
  if (mapped) saveProfileBuildRunState(mapped)
  return { ok: true }
}

async function pollServerBuildRun(
  onStep?: (step: number, label: string) => void
): Promise<{ ok: true } | { ok: false; message: string }> {
  const build = loadBuildState()
  const fallbackVersion = makeBuildVersion(build)
  const MAX_POLLS = 120

  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await apiRequest<{
      run?: ServerBuildRun | null
      firstVisibleSnapshotReady?: boolean
    }>('/api/profile/build-run', { method: 'GET' })
    if (!res.ok) {
      return { ok: false, message: res.error.message || '无法获取画像整理进度' }
    }
    const mapped = mapServerRun(res.data.run, fallbackVersion, res.data.firstVisibleSnapshotReady)
    if (mapped) {
      saveProfileBuildRunState(mapped)
      onStep?.(mapped.phase, mapped.label)
      if (mapped.status === 'succeeded') {
        await hydrateBuiltSnapshotFromServer()
        return { ok: true }
      }
      if (mapped.status === 'failed') {
        return { ok: false, message: mapped.error || '画像整理未完成' }
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return { ok: false, message: '画像整理超时，请稍后重试' }
}

export async function retryServerProfileBuildRun(
  fromStage?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await apiRequest<{ run?: ServerBuildRun; firstVisibleSnapshotReady?: boolean }>(
    '/api/profile/build-run/retry',
    {
      method: 'POST',
      data: fromStage ? { fromStage } : {},
    }
  )
  if (!res.ok) {
    return { ok: false, message: res.error.message || '重试失败' }
  }
  const build = loadBuildState()
  const mapped = mapServerRun(res.data.run, makeBuildVersion(build), res.data.firstVisibleSnapshotReady)
  if (mapped) saveProfileBuildRunState(mapped)
  return { ok: true }
}

/** @deprecated 保留给极端离线兜底；正常流程走服务端 build run。 */
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

  await hydrateBuiltSnapshotFromServer()
  onStep(4, '整理首版画像…')
  await waitForProfileReadiness()
  return { ok: true }
}

/**
 * 服务端 durable build run：最后补充提交后冻结输入并在后台执行 synthesis→diagnosis→persist。
 * 基础资料页与生成页订阅同一条 run；微信回收后通过 GET 恢复进度。
 */
export function ensureProfileBuildInFlight(
  onStep?: (step: number, label: string) => void
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (activeProfileBuildPromise) return activeProfileBuildPromise

  const buildVersion = makeBuildVersion(loadBuildState())
  const startedAt = new Date().toISOString()

  activeProfileBuildPromise = (async () => {
    const existing = await fetchServerBuildRun()
    if (!existing || existing.buildVersion !== buildVersion || existing.status === 'failed') {
      const started = await startServerProfileBuildRun()
      if (!started.ok) return started
    } else if (existing.status === 'succeeded') {
      await hydrateBuiltSnapshotFromServer()
      saveProfileBuildRunState({
        ...existing,
        buildVersion,
        status: 'succeeded',
        phase: 4,
        label: '画像已准备好',
        startedAt: existing.startedAt || startedAt,
        updatedAt: new Date().toISOString(),
      })
      return { ok: true as const }
    }

    const result = await pollServerBuildRun(onStep)
    const latest = getProfileBuildRunState()
    saveProfileBuildRunState({
      runId: latest?.runId,
      buildVersion,
      status: result.ok ? 'succeeded' : 'failed',
      phase: result.ok ? 4 : latest?.phase || 0,
      label: result.ok ? '画像已准备好' : '画像整理未完成',
      startedAt: latest?.startedAt || startedAt,
      updatedAt: new Date().toISOString(),
      error: result.ok ? undefined : result.message,
      failedStage: latest?.failedStage,
      firstVisibleSnapshotReady: latest?.firstVisibleSnapshotReady,
    })
    return result
  })().finally(() => {
    activeProfileBuildPromise = null
  })

  return activeProfileBuildPromise
}

export async function waitForProfileReadiness(): Promise<void> {
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

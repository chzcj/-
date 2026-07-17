import { computeProfileInputVersion } from '@/lib/profile/build-input'
import { getStorage } from '@/lib/storage/localStorageService'

const BUILD_MODULE_KEYS = ['daily', 'homework', 'communication', 'family'] as const

const LEGACY_MERGE: Record<string, string> = {
  study: 'homework',
  routine: 'daily',
  emotion: 'communication',
  environment: 'family',
}

export type WebBuildEntryModule = {
  rawTexts: string[]
  followUps: string[]
  stageSummary?: string
  aiFacts?: string[]
  aiHypotheses?: string[]
  moduleComplete?: boolean
  summarySufficient?: boolean
}

export type ServerBuildRun = {
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

export type ProfileBuildRunView = {
  run: ServerBuildRun | null
  firstVisibleSnapshotReady?: boolean
}

const POLL_INTERVAL_MS = 2000

export function buildWebEntryMapFromStorage(): {
  entryMap: Record<string, WebBuildEntryModule>
  finalFollowUpText: string
  inputVersion: string
} {
  const storage = getStorage()
  const entryRecords = storage.entryRecords || []
  const stageSummaries = storage.stageSummaries || []
  const followUpRecords = storage.followUpRecords || []
  const buildSession =
    storage.buildSessions?.find((s) => s.status === 'completed') ||
    storage.buildSessions?.[storage.buildSessions.length - 1]

  const entryMap: Record<string, WebBuildEntryModule> = {}
  for (const key of BUILD_MODULE_KEYS) {
    entryMap[key] = { rawTexts: [], followUps: [] }
  }

  for (const r of entryRecords) {
    const key = entryMap[r.entryType] ? r.entryType : LEGACY_MERGE[r.entryType]
    const e = key ? entryMap[key] : undefined
    if (e) e.rawTexts.push(r.rawText)
  }
  for (const s of stageSummaries) {
    const key = entryMap[s.entryType] ? s.entryType : LEGACY_MERGE[s.entryType]
    const e = key ? entryMap[key] : undefined
    if (e) {
      e.stageSummary = s.mainJudgment
      e.aiFacts = s.facts
      e.aiHypotheses = s.pendingHypotheses
    }
  }
  for (const f of followUpRecords) {
    if (f.entryType === 'final') continue
    const key = entryMap[f.entryType] ? f.entryType : LEGACY_MERGE[f.entryType]
    const e = key ? entryMap[key] : undefined
    if (e && f.userAnswer) e.followUps.push(f.userAnswer)
  }

  const completedList = buildSession?.completedEntries || []
  const completedSet = new Set(completedList.map((e: string) => LEGACY_MERGE[e] || e))
  for (const key of BUILD_MODULE_KEYS) {
    const mod = entryMap[key]
    if (!mod) continue
    mod.moduleComplete = completedSet.has(key) || Boolean(mod.stageSummary)
  }

  const finalFollowUpText = followUpRecords
    .filter((f) => f.entryType === 'final' && f.userAnswer)
    .map((f) => f.userAnswer)
    .join('\n')

  const inputVersion = computeProfileInputVersion({ entryMap, finalFollowUpText })
  return { entryMap, finalFollowUpText, inputVersion }
}

async function parseJson<T>(res: Response): Promise<{ ok: boolean; data?: T; error?: { message?: string } }> {
  const json = (await res.json()) as { ok?: boolean; data?: T; error?: { message?: string } }
  return { ok: Boolean(json.ok), data: json.data, error: json.error }
}

export async function fetchServerBuildRun(): Promise<ProfileBuildRunView | null> {
  try {
    const res = await fetch('/api/profile/build-run', { credentials: 'include' })
    const json = await parseJson<ProfileBuildRunView>(res)
    return json.ok ? json.data || null : null
  } catch {
    return null
  }
}

export async function startServerProfileBuildRun(): Promise<{ ok: true } | { ok: false; message: string }> {
  const { entryMap, finalFollowUpText } = buildWebEntryMapFromStorage()
  try {
    const res = await fetch('/api/profile/build-run', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryMap, finalFollowUpText }),
    })
    const json = await parseJson<ProfileBuildRunView>(res)
    if (!json.ok) {
      return { ok: false, message: json.error?.message || '无法启动画像整理' }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: '无法启动画像整理' }
  }
}

export async function retryServerProfileBuildRun(
  fromStage?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/profile/build-run/retry', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fromStage ? { fromStage } : {}),
    })
    const json = await parseJson<ProfileBuildRunView>(res)
    if (!json.ok) {
      return { ok: false, message: json.error?.message || '重试失败' }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: '重试失败' }
  }
}

export async function pollServerBuildRun(
  onStep?: (phase: number, label: string) => void
): Promise<{ ok: true } | { ok: false; message: string }> {
  const MAX_POLLS = 120
  for (let i = 0; i < MAX_POLLS; i++) {
    const view = await fetchServerBuildRun()
    const run = view?.run
    if (run) {
      onStep?.(run.phase, run.label)
      if (run.status === 'succeeded') return { ok: true }
      if (run.status === 'failed') {
        return { ok: false, message: run.error || '画像整理未完成' }
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return { ok: false, message: '画像整理超时，请稍后重试' }
}

export async function ensureWebProfileBuildInFlight(
  onStep?: (phase: number, label: string) => void
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { inputVersion } = buildWebEntryMapFromStorage()
  const existing = await fetchServerBuildRun()
  const run = existing?.run
  if (
    !run ||
    run.inputVersion !== inputVersion ||
    run.status === 'failed'
  ) {
    const started = await startServerProfileBuildRun()
    if (!started.ok) return started
  } else if (run.status === 'succeeded') {
    return { ok: true }
  }
  return pollServerBuildRun(onStep)
}

export async function hydrateBuiltSnapshotFromServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/profile/built', { credentials: 'include' })
    const json = await parseJson<{ snapshot?: { coreJudgment?: string } }>(res)
    if (!json.ok || !json.data?.snapshot?.coreJudgment?.trim()) return false
    const { createProfileSnapshot } = await import('@/lib/storage/profileStorage')
    createProfileSnapshot(json.data.snapshot as never)
    const { forceAccountSyncToServer } = await import('@/lib/account/accountSync')
    await forceAccountSyncToServer()
    return true
  } catch {
    return false
  }
}

import 'server-only'

import { BUILD_MODULE_KEYS } from '@/lib/profile/build-input'
import { LEGACY_TO_NEW } from '@/lib/server/memory/entry-builder'
import {
  getBuildProgress,
  getEntryEvidencePacks,
  getLatestBuiltProfileSnapshot,
  getLatestProfileBuildRun,
} from '@/lib/server/memory/database-manager'
import {
  enqueueJob,
  getJobHealth,
  readWorkerHeartbeat,
  type JobHealth,
} from '@/lib/server/jobs/queue'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { EntryName } from '@/types/database'

const MODULE_LABEL: Record<string, string> = {
  daily: '日常节奏',
  homework: '学习作业',
  communication: '亲子沟通',
  family: '家庭支持',
}

const WORKER_STALE_MS = Number(process.env.JOB_POLL_MS || 3000) * 3
const RECONCILE_COOLDOWN_MS = 60_000

type ModuleAudit = {
  entryType: string
  entryName: EntryName
  label: string
  packReady: boolean
  /** 最近一次 entry_evidence job 状态（按 trace entry_${type} 或 payload 匹配） */
  evidenceJobStatus?: string
  gap?: string
}

export type OnboardingPipelineAudit = {
  workerAlive: boolean
  workerHeartbeatAgeMs: number | null
  modules: ModuleAudit[]
  buildRunStatus: string | null
  builtSnapshotReady: boolean
  jobHealth?: JobHealth
  gaps: string[]
  /** 监督判定：无阻断性缺口且 worker 在动 */
  healthy: boolean
  reconciledAt?: string
  replayedFailedJobs?: number
}

const g = globalThis as typeof globalThis & {
  __onboardingReconcileAt?: Map<string, number>
}

function reconcileCooldownKey(tenant: TenantId): string {
  return `${tenant.familyId}:${tenant.childId}`
}

function shouldThrottleReconcile(tenant: TenantId): boolean {
  const map = (g.__onboardingReconcileAt ||= new Map())
  const key = reconcileCooldownKey(tenant)
  const last = map.get(key) || 0
  if (Date.now() - last < RECONCILE_COOLDOWN_MS) return true
  map.set(key, Date.now())
  return false
}

async function getLatestEvidenceJobStatuses(
  tenant: TenantId
): Promise<Record<string, string>> {
  const { isDatabaseEnabled } = await import('@/lib/server/db')
  if (!isDatabaseEnabled()) return {}
  const { jobPool, ensureJobSchemaForAudit } = await import('@/lib/server/jobs/job-audit')
  const pool = jobPool()
  if (!pool) return {}
  await ensureJobSchemaForAudit(pool)
  const fam = tenant.familyId
  const r = await pool.query<{ entry_type: string | null; status: string }>(
    `SELECT DISTINCT ON (COALESCE(payload->>'entryType', trace_id)) 
            COALESCE(payload->>'entryType', replace(trace_id, 'entry_', '')) AS entry_type,
            status
     FROM job_queue
     WHERE job_type = 'entry_evidence'
       AND COALESCE(payload->'tenant'->>'familyId', payload->'ctx'->>'familyId') = $1
     ORDER BY COALESCE(payload->>'entryType', trace_id), id DESC
     LIMIT 20`,
    [fam]
  )
  const out: Record<string, string> = {}
  for (const row of r.rows) {
    if (row.entry_type) out[row.entry_type] = row.status
  }
  return out
}

/** 读-only：四模块 + build-run 后台链路是否真正在跑、是否落库。 */
export async function auditOnboardingPipeline(tenant: TenantId): Promise<OnboardingPipelineAudit> {
  const [progress, packs, buildRun, built, heartbeat, jobHealth, evidenceJobsRaw] = await Promise.all([
    getBuildProgress(tenant).catch(() => null),
    getEntryEvidencePacks(tenant).catch(() => []),
    getLatestProfileBuildRun(tenant).catch(() => null),
    getLatestBuiltProfileSnapshot(tenant).catch(() => null),
    readWorkerHeartbeat().catch(() => ({ at: null, ageMs: null })),
    getJobHealth(tenant).catch(() => undefined),
    getLatestEvidenceJobStatuses(tenant).catch(() => ({} as Record<string, string>)),
  ])
  const evidenceJobs: Record<string, string> = evidenceJobsRaw

  const completed = new Set(progress?.completedEntries || [])
  const packByName = new Set(packs.map((p) => p.entryName))
  const gaps: string[] = []

  const workerAlive = heartbeat.ageMs !== null && heartbeat.ageMs < WORKER_STALE_MS
  if (!workerAlive) {
    gaps.push('job worker 心跳过期或未启动（后台任务可能只入队不执行）')
  }

  const modules: ModuleAudit[] = BUILD_MODULE_KEYS.map((entryType) => {
    const entryName = LEGACY_TO_NEW[entryType] as EntryName
    const packReady = packByName.has(entryName)
    const evidenceJobStatus = evidenceJobs[entryType]
    const confirmed = completed.has(entryType)
    let gap: string | undefined
    if (confirmed && !packReady) {
      if (evidenceJobStatus === 'failed') {
        gap = `${MODULE_LABEL[entryType]} entry_evidence 已失败`
      } else if (evidenceJobStatus === 'pending' || evidenceJobStatus === 'running' || evidenceJobStatus === 'retrying') {
        gap = `${MODULE_LABEL[entryType]} L3 证据包仍在排队/执行中`
      } else if (!evidenceJobStatus) {
        gap = `${MODULE_LABEL[entryType]} 未见 entry_evidence 入队记录`
      } else {
        gap = `${MODULE_LABEL[entryType]} job 已成功但 L3 包缺失（需排查写库）`
      }
    }
    if (gap) gaps.push(gap)
    return {
      entryType,
      entryName,
      label: MODULE_LABEL[entryType] || entryType,
      packReady,
      evidenceJobStatus,
      gap,
    }
  })

  const buildRunStatus = buildRun?.status ?? null
  const builtSnapshotReady = Boolean(built?.coreJudgment?.trim())

  if (buildRunStatus === 'failed') {
    gaps.push(`profile_build_run 失败：${buildRun?.error || buildRun?.failedStage || 'unknown'}`)
  }
  if (buildRunStatus === 'pending' || buildRunStatus === 'running') {
    const ageMs = buildRun?.updatedAt ? Date.now() - new Date(buildRun.updatedAt).getTime() : 0
    if (ageMs > 20 * 60_000) {
      gaps.push('profile_build_run 运行超过 20 分钟，可能僵尸或队列堵塞')
    }
  }
  if (buildRunStatus === 'succeeded' && !builtSnapshotReady) {
    gaps.push('build-run 已成功但 built_profile_snapshots 无 coreJudgment')
  }

  const failedTotal = jobHealth?.totals.failed ?? 0
  if (failedTotal > 0) {
    gaps.push(`本租户有 ${failedTotal} 条 failed 后台 job（监督将尝试重投）`)
  }

  const blockingGaps = gaps.filter(
    (g) =>
      !g.includes('仍在排队') &&
      !g.includes('执行中')
  )
  const healthy =
    workerAlive &&
    blockingGaps.length === 0 &&
    (buildRunStatus !== 'failed')

  return {
    workerAlive,
    workerHeartbeatAgeMs: heartbeat.ageMs,
    modules,
    buildRunStatus,
    builtSnapshotReady,
    jobHealth,
    gaps,
    healthy,
  }
}

/**
 * 监督补跑：重投 failed 关键 job；对已确认模块但缺 L3 且无在途 job 的，用 build_progress 摘要补 enqueue。
 * GET build-run 轮询时触发，60s/租户节流。
 */
export async function reconcileOnboardingPipeline(tenant: TenantId): Promise<{
  replayedFailedJobs: number
  requeuedEvidence: number
}> {
  if (shouldThrottleReconcile(tenant)) {
    return { replayedFailedJobs: 0, requeuedEvidence: 0 }
  }

  const { isDatabaseEnabled } = await import('@/lib/server/db')
  if (!isDatabaseEnabled()) return { replayedFailedJobs: 0, requeuedEvidence: 0 }

  const { jobPool, ensureJobSchemaForAudit } = await import('@/lib/server/jobs/job-audit')
  const pool = jobPool()
  if (!pool) return { replayedFailedJobs: 0, requeuedEvidence: 0 }
  await ensureJobSchemaForAudit(pool)

  const fam = tenant.familyId
  const FILTER = `COALESCE(payload->'tenant'->>'familyId', payload->'ctx'->>'familyId') = $1`
  const replay = await pool.query(
    `UPDATE job_queue SET status='pending', last_error=NULL, run_after=NOW(), updated_at=NOW()
     WHERE id IN (
       SELECT id FROM job_queue
       WHERE status='failed'
         AND job_type IN ('entry_evidence','episode_ingest','profile_build_run')
         AND ${FILTER}
       ORDER BY id DESC
       LIMIT 8
     )`,
    [fam]
  )

  let requeuedEvidence = 0
  const progress = await getBuildProgress(tenant).catch(() => null)
  const packs = await getEntryEvidencePacks(tenant).catch(() => [])
  const packNames = new Set(packs.map((p) => p.entryName))
  const evidenceJobs = await getLatestEvidenceJobStatuses(tenant)
  const dayBucket = new Date().toISOString().slice(0, 10)

  for (const summary of progress?.stageSummaries || []) {
    const entryType = summary.entryType
    if (!BUILD_MODULE_KEYS.includes(entryType as (typeof BUILD_MODULE_KEYS)[number])) continue
    if (!progress?.completedEntries?.includes(entryType)) continue
    const entryName = LEGACY_TO_NEW[entryType]
    if (packNames.has(entryName)) continue
    const st = evidenceJobs[entryType]
    if (st === 'pending' || st === 'running' || st === 'retrying') continue

    const rawText = [summary.mainJudgment, ...(summary.facts || [])].filter(Boolean).join('\n')
    if (!rawText.trim()) continue

    await enqueueJob(
      'entry_evidence',
      {
        entryType,
        rawText,
        frontSummary: summary.mainJudgment,
        facts: summary.facts || [],
        hypotheses: summary.pendingHypotheses || [],
        tenant,
      },
      `entry_evd_reconcile:${fam}:${tenant.childId}:${entryType}:${dayBucket}`,
      `reconcile_${entryType}`
    )
    requeuedEvidence++
    console.warn(`[onboarding-supervisor] 补队 entry_evidence entryType=${entryType} reason=missing_l3_pack`)
  }

  if (replay.rowCount || requeuedEvidence) {
    console.info(
      `[onboarding-supervisor] reconcile family=${fam} replayedFailed=${replay.rowCount || 0} requeuedEvidence=${requeuedEvidence}`
    )
  }

  return { replayedFailedJobs: replay.rowCount || 0, requeuedEvidence }
}

/** 轮询入口：先 audit，不健康则 reconcile，再 audit 一次供 UI 展示。 */
export async function superviseOnboardingPipeline(tenant: TenantId): Promise<OnboardingPipelineAudit> {
  let audit = await auditOnboardingPipeline(tenant)
  if (!audit.healthy) {
    const r = await reconcileOnboardingPipeline(tenant)
    if (r.replayedFailedJobs > 0 || r.requeuedEvidence > 0) {
      audit = await auditOnboardingPipeline(tenant)
      audit.replayedFailedJobs = r.replayedFailedJobs
      audit.reconciledAt = new Date().toISOString()
    }
  }
  return audit
}

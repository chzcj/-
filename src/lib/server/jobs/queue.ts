import 'server-only'
import pg from 'pg'
import { createHash } from 'node:crypto'
import { isDatabaseEnabled } from '@/lib/server/db'
import { executeWritePlan } from '@/lib/server/memory/write/decision-engine'
import { ingestEpisodeStrict, type IngestContext } from '@/lib/server/memory/episode/pipeline'
import { rebuildBriefAndBoard } from '@/lib/server/memory/digest/updaters'
import { runEntryEvidenceBuild, type EntryEvidencePayload } from '@/lib/server/memory/entry-evidence/builder'
import { runModelReview } from '@/lib/server/memory/model-review/reviewer'
import { runDailyDeep, type DailyDeepPayload } from '@/lib/server/memory/daily-deep/builder'
import { runProfileRewrite } from '@/lib/server/profile-rewrite'
import { runDeepMechanismReview } from '@/lib/server/memory/deep-mechanism/reviewer'
import { runGrowthTrajectoryUpdate } from '@/lib/server/profile/growth-trajectory'
import {
  isDeepMechanismS2Enabled,
  markDeepMechanismJobCompleted,
} from '@/lib/server/memory/deep-mechanism/turn-signal'
import {
  deepMechanismBucketKey,
  deepMechanismDailyOpenKey,
} from '@/lib/server/memory/deep-mechanism/s2-flags'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { MemoryWritePlan } from '@/types/database'

export {
  deepMechanismBucketKey,
  deepMechanismDailyOpenKey,
  deepMechanismTurnMilestoneKey,
} from '@/lib/server/memory/deep-mechanism/s2-flags'

/* ================================================================
   Job Queue — 可靠后台任务队列（交付文档 14.3）
   PG 表 + in-process poller（pm2 单实例）。状态：pending/running/succeeded/failed/retrying。
   失败指数退避重试；幂等键去重；CAS 终态守卫；心跳防僵尸误判；DB 未启用→inline 降级。
   ================================================================ */

type JobType = 'memory_write' | 'episode_ingest' | 'digest_update' | 'entry_evidence' | 'model_review' | 'daily_deep' | 'profile_rewrite' | 'deep_mechanism_review' | 'growth_trajectory_update'
interface MemoryWritePayload { plan: MemoryWritePlan; tenant: TenantId }
interface EpisodeIngestPayload { text: string; ctx: IngestContext }
interface DigestUpdatePayload { tenant: TenantId }

const BATCH = Number(process.env.JOB_BATCH || 2)            // 每轮最多取几条，配合小连接池
const ZOMBIE_MIN = Number(process.env.JOB_ZOMBIE_MIN || 15) // running 超时回收阈值（>> handler p99）
const POLL_MS = Number(process.env.JOB_POLL_MS || 3000)

type JobGlobal = typeof globalThis & {
  __childosJobPool?: pg.Pool
  __childosJobSchemaReady?: Promise<void>
  __childosJobTimer?: ReturnType<typeof setInterval>
  __childosJobTick?: Promise<void>
  __childosJobInflight?: Set<string>
}
const g = globalThis as JobGlobal

// 独立小池，与前台池（max=5）隔离，避免 poller 占满前台连接。
function jobPool(): pg.Pool | undefined {
  if (!isDatabaseEnabled()) return undefined
  if (!g.__childosJobPool) {
    g.__childosJobPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.JOB_POOL_MAX || 2),
      idleTimeoutMillis: 30_000
    })
  }
  return g.__childosJobPool
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS job_queue (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_type        TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    idempotency_key TEXT,
    trace_id        TEXT,
    attempts        INT  NOT NULL DEFAULT 0,
    max_attempts    INT  NOT NULL DEFAULT 5,
    run_after       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_job_idem ON job_queue (idempotency_key) WHERE idempotency_key IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_job_claim ON job_queue (status, run_after) WHERE status IN ('pending','retrying');
  CREATE INDEX IF NOT EXISTS idx_job_running ON job_queue (status, updated_at) WHERE status = 'running';
  CREATE INDEX IF NOT EXISTS idx_job_trace ON job_queue (trace_id) WHERE trace_id IS NOT NULL;
`

// 独立 ready 标记；失败清空以便下次重试，绝不掺迁移，不污染主 schema。
async function ensureJobSchema(pool: pg.Pool): Promise<void> {
  if (!g.__childosJobSchemaReady) {
    g.__childosJobSchemaReady = pool.query(SCHEMA_SQL).then(() => undefined).catch(err => {
      g.__childosJobSchemaReady = undefined
      throw err
    })
  }
  await g.__childosJobSchemaReady
}

export function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32)
}

// 模型复核限流键：按「自然日 + 租户」时间桶。每租户每天至多触发一次 model_review（unique idem 去重）。
// runModelReview 无活跃假设时 no-op（不空跑 LLM），故安全可超发。daily/stream 不再直接入队，
// 仅 memory_write 写入待验证假设后链式触发，复用此 key 实现每日 1 次频控。
export function modelReviewBucketKey(tenant: TenantId): string {
  const dayBucket = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
  return `model_review:${tenant.familyId}:${tenant.childId}:${dayBucket}`
}

// Brief/Board 重建限流键：按「自然日 + 租户」时间桶。每租户每天至多重建一次 familyBrief + boardSnapshot。
// 同行最佳实践（Mem0/Zep）：后台周期性合并而非每次写入触发，避免每条 memory_write 都跑 2 次 LLM。
// rebuildBriefAndBoard 内部 collectEvidence 读全量记忆 + contentHash 指纹短路，故每日 1 次足够新鲜。
export function digestUpdateBucketKey(tenant: TenantId): string {
  const dayBucket = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
  return `digest_update:${tenant.familyId}:${tenant.childId}:${dayBucket}`
}

/** 画像重写 2 天桶：每租户每 2 天至多 1 次重写（登录触发 + bucket 幂等双保险）。 */
export function profileRewriteBucketKey(tenant: TenantId): string {
  const epochBucket = Math.floor(Date.now() / (2 * 24 * 60 * 60 * 1000))
  return `profile_rewrite:${tenant.familyId}:${tenant.childId}:${epochBucket}`
}

/** 深度机制复核幂等键见 s2-flags.ts（日桶 / daily_open / turn milestone 正交）。 */

// 两个 handler。executeWritePlan/ingestEpisodeStrict 内绝不吞异常，异常上抛驱动重试。
async function runJob(jobType: JobType, payload: unknown): Promise<void> {
  if (jobType === 'memory_write') {
    const p = payload as MemoryWritePayload
    await executeWritePlan(p.plan, p.tenant)
    // 链式触发 Brief/Board 更新（文档 12.1：后台写入→Brief→看板）。
    // 每日桶频控：每租户每天至多重建 1 次（同行 Mem0/Zep 后台周期性合并范式）；rebuildBriefAndBoard 内 content_hash 短路兜底。
    await enqueueJob('digest_update', { tenant: p.tenant }, digestUpdateBucketKey(p.tenant), null)
    // 写了待验证假设（综合/诊断后）→ 链式触发模型复核（反证收集+置信度，P2 后台深）。
    // 仅在有假设时触发，避免在 daily 等普通写入上空跑 LLM。复用每日桶 key → 每租户每天最多 1 次。
    if ((p.plan.pendingHypothesesToCreateOrUpdate?.length || 0) > 0) {
      await enqueueJob('model_review', { tenant: p.tenant }, modelReviewBucketKey(p.tenant), null)
    }
    // 链式深度机制复核（每日桶）：覆盖 evidence_networks 机制层 + 写 parent_narrative_patterns。
    // runDeepMechanismReview 信息不足时 no-op，桶超发安全。
    await enqueueJob('deep_mechanism_review', { tenant: p.tenant }, deepMechanismBucketKey(p.tenant), null)
  } else if (jobType === 'episode_ingest') {
    const p = payload as EpisodeIngestPayload
    await ingestEpisodeStrict(p.text, p.ctx)
  } else if (jobType === 'digest_update') {
    const p = payload as DigestUpdatePayload
    await rebuildBriefAndBoard(p.tenant) // 幂等，重跑安全
  } else if (jobType === 'entry_evidence') {
    const p = payload as EntryEvidencePayload
    await runEntryEvidenceBuild(p) // 后台深度拆解入口证据包，不吞异常驱动重试
    // 采集后强制刷新 digest + model_review（双保险）：entry pack 写入后画像/看板需重建，
    // 此前 entry_evidence 绕过 memory_write 链导致采集后画像不刷新。桶 key 幂等，今天已排则跳过。
    await enqueueJob('digest_update', { tenant: p.tenant }, digestUpdateBucketKey(p.tenant), null)
    await enqueueJob('model_review', { tenant: p.tenant }, modelReviewBucketKey(p.tenant), null)
    // 深度机制链仅在四模块齐/final 或 memory_write 日桶触发，避免单模块半成品跑满链
  } else if (jobType === 'model_review') {
    const p = payload as DigestUpdatePayload
    await runModelReview(p.tenant) // 复核待验证假设：反证+置信度，幂等可重跑
  } else if (jobType === 'daily_deep') {
    // 日常对话深拆：六维拆解 + 保守生成新假设。有新假设 → 走标准 memory_write
    // （→ 链式 model_review 完成反馈复盘）；无则 no-op，不空跑、不写库。
    const r = await runDailyDeep(payload as DailyDeepPayload)
    if (r) await enqueueJob('memory_write', { plan: r.plan, tenant: r.tenant }, null, null)
  } else if (jobType === 'profile_rewrite') {
    // 每 2 天登录触发：基于记忆层整体重写画像字段 → 链式 digest_update 刷新 brief/board。
    const p = payload as DigestUpdatePayload
    await runProfileRewrite(p.tenant)
  } else if (jobType === 'deep_mechanism_review') {
    // 深度机制复核：读全量记忆 → 五大生态系统+16家庭理论 → 覆盖 evidence_networks 机制层 +
    // 写 pending_hypotheses + 写 parent_narrative_patterns（修复 dead write）。
    // 触发：四模块完成立即（build key）+ memory_write 日桶 + S2 daily_open / turn milestone。
    const p = payload as DigestUpdatePayload
    const wrote = await runDeepMechanismReview(p.tenant) // 信息不足时 no-op；不吞异常驱动重试
    if (wrote) {
      await markDeepMechanismJobCompleted(p.tenant).catch((err) =>
        console.warn('[jobs] markDeepMechanismJobCompleted 失败:', err)
      )
    }
  } else if (jobType === 'growth_trajectory_update') {
    const p = payload as { tenant: TenantId; sourceHash?: string }
    await runGrowthTrajectoryUpdate(p.tenant, p.sourceHash)
  }
}

function runJobInline(jobType: JobType, payload: unknown): Promise<void> {
  return runJob(jobType, payload).catch(err =>
    console.error('[jobs] inline 执行失败（降级路径，无重试）:', jobType, err))
}

// 入队。统一 JSON 往返让两条路径 handler 只见纯数据；DB 关→inline；入队失败→回退 inline（不丢数据）。
// traceId 写入 trace_id 列，使一次用户对话产生的 memory_write + episode_ingest 两个 job 可按 traceId 关联追溯。
export async function enqueueJob(jobType: JobType, payload: unknown, idemKey?: string | null, traceId?: string | null): Promise<void> {
  const normalized = JSON.parse(JSON.stringify(payload))

  if (!isDatabaseEnabled()) {
    void runJobInline(jobType, normalized)
    return
  }

  const pool = jobPool()
  if (!pool) {
    void runJobInline(jobType, normalized)
    return
  }
  try {
    await ensureJobSchema(pool)
    await pool.query(
      `INSERT INTO job_queue (job_type, payload, idempotency_key, trace_id)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
      [jobType, JSON.stringify(normalized), idemKey ?? null, traceId ?? null]
    )
  } catch (err) {
    console.error('[jobs] enqueue 失败，回退 inline:', jobType, err)
    void runJobInline(jobType, normalized)
  }
}

/* 闭环可观测（测评反馈 P2-④）：按租户查后台 job 健康度，让"生成→写入→检索→使用"可验证、失败可见。
   tenant 在 memory_write/digest/entry_evidence/model_review 的 payload.tenant，episode_ingest 在 payload.ctx，故 COALESCE。 */
export interface JobHealth {
  byType: Record<string, Record<string, number>>
  totals: { pending: number; running: number; retrying: number; succeeded: number; failed: number }
  recentFailures: Array<{ jobType: string; attempts: number; maxAttempts: number; lastError: string; at: string }>
}

export async function getJobHealth(tenant: TenantId): Promise<JobHealth | undefined> {
  const pool = jobPool()
  if (!pool) return undefined
  await ensureJobSchema(pool)
  const fam = tenant.familyId
  const FILTER = `COALESCE(payload->'tenant'->>'familyId', payload->'ctx'->>'familyId') = $1`

  const counts = await pool.query<{ job_type: string; status: string; n: number }>(
    `SELECT job_type, status, count(*)::int AS n FROM job_queue WHERE ${FILTER} GROUP BY job_type, status`,
    [fam]
  )
  const fails = await pool.query<{ job_type: string; attempts: number; max_attempts: number; last_error: string | null; updated_at: Date | string }>(
    `SELECT job_type, attempts, max_attempts, last_error, updated_at FROM job_queue
     WHERE status = 'failed' AND ${FILTER} ORDER BY updated_at DESC LIMIT 5`,
    [fam]
  )

  const byType: Record<string, Record<string, number>> = {}
  const totals = { pending: 0, running: 0, retrying: 0, succeeded: 0, failed: 0 }
  for (const r of counts.rows) {
    ;(byType[r.job_type] ||= {})[r.status] = r.n
    if (r.status in totals) (totals as Record<string, number>)[r.status] += r.n
  }
  return {
    byType,
    totals,
    recentFailures: fails.rows.map(f => ({
      jobType: f.job_type,
      attempts: f.attempts,
      maxAttempts: f.max_attempts,
      lastError: (f.last_error || '').slice(0, 200),
      at: f.updated_at instanceof Date ? f.updated_at.toISOString() : String(f.updated_at),
    })),
  }
}

/** 全局 job 健康度（管理员后台用，跨所有租户，不带 tenant 过滤）。 */
export async function getGlobalJobHealth(): Promise<JobHealth | undefined> {
  const pool = jobPool()
  if (!pool) return undefined
  await ensureJobSchema(pool)
  const counts = await pool.query<{ job_type: string; status: string; n: number }>(
    `SELECT job_type, status, count(*)::int AS n FROM job_queue GROUP BY job_type, status`
  )
  const fails = await pool.query<{ job_type: string; attempts: number; max_attempts: number; last_error: string | null; updated_at: Date | string }>(
    `SELECT job_type, attempts, max_attempts, last_error, updated_at FROM job_queue
     WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 10`
  )
  const byType: Record<string, Record<string, number>> = {}
  const totals = { pending: 0, running: 0, retrying: 0, succeeded: 0, failed: 0 }
  for (const r of counts.rows) {
    ;(byType[r.job_type] ||= {})[r.status] = r.n
    if (r.status in totals) (totals as Record<string, number>)[r.status] += r.n
  }
  return {
    byType,
    totals,
    recentFailures: fails.rows.map(f => ({
      jobType: f.job_type,
      attempts: f.attempts,
      maxAttempts: f.max_attempts,
      lastError: (f.last_error || '').slice(0, 200),
      at: f.updated_at instanceof Date ? f.updated_at.toISOString() : String(f.updated_at),
    })),
  }
}

// 认领一条并执行。claim 用 FOR UPDATE SKIP LOCKED；running 提前 COMMIT 后再跑 AI；终态用 CAS 守卫。
async function claimAndRunOne(pool: pg.Pool): Promise<boolean> {
  const client = await pool.connect()
  let job: { id: string; job_type: JobType; payload: unknown; attempts: number; max_attempts: number } | undefined
  try {
    await client.query('BEGIN')
    const r = await client.query<{ id: string; job_type: JobType; payload: unknown; attempts: number; max_attempts: number }>(
      `UPDATE job_queue SET status='running', attempts=attempts+1, updated_at=NOW()
       WHERE id = (
         SELECT id FROM job_queue
         WHERE status IN ('pending','retrying') AND run_after <= NOW()
         ORDER BY id
         FOR UPDATE SKIP LOCKED
         LIMIT 1)
       RETURNING id, job_type, payload, attempts, max_attempts`
    )
    await client.query('COMMIT')
    job = r.rows[0]
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[jobs] claim 失败:', err)
    return false
  } finally {
    client.release()
  }
  if (!job) return false

  const idStr = String(job.id)
  ;(g.__childosJobInflight ||= new Set()).add(idStr)
  // 心跳：执行期间每 5s 同时推「job updated_at」（防僵尸误判）与「worker 心跳」——
  // 此前 worker 心跳只在 tick 间隙写，长 LLM job（30-60s+）执行中停更，
  // readiness 会误报 workerAlive=false（阈值 ~9s）。失败记日志。
  const hb = setInterval(() => {
    void pool.query(`UPDATE job_queue SET updated_at=NOW() WHERE id=$1 AND status='running'`, [job!.id])
      .catch(err => console.warn(`[jobs] 心跳更新失败 id=${job!.id}:`, err instanceof Error ? err.message : err))
    void writeWorkerHeartbeat(pool)
  }, 5_000)
  hb.unref?.()

  try {
    await runJob(job.job_type, job.payload)
    // CAS：仅当仍为 running 才置成功，避免覆盖被僵尸回收转走的状态。
    await pool.query(`UPDATE job_queue SET status='succeeded', updated_at=NOW() WHERE id=$1 AND status='running'`, [job.id])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const fatal = message === 'EPISODE_VECTOR_UNAVAILABLE' // 基础设施不可用→fail-fast，不耗尽 attempts
    const dead = fatal || job.attempts >= job.max_attempts
    const next = dead ? 'failed' : 'retrying'
    const backoff = Math.min(2 ** job.attempts * 5, 300) // 5s,10s,20s… 上限 5min
    await pool.query(
      `UPDATE job_queue SET status=$2, last_error=$3,
         run_after = CASE WHEN $2='retrying' THEN NOW() + ($4 || ' seconds')::interval ELSE run_after END,
         updated_at=NOW()
       WHERE id=$1 AND status='running'`,
      [job.id, next, message.slice(0, 1000), backoff]
    ).catch(e => console.error('[jobs] 终态写入失败:', e))
    if (next === 'failed') console.error(`[jobs] FAILED type=${job.job_type} id=${job.id} err=${message}`)
    else console.warn(`[jobs] retrying type=${job.job_type} id=${job.id} attempt=${job.attempts} backoff=${backoff}s`)
  } finally {
    clearInterval(hb)
    g.__childosJobInflight?.delete(idStr)
  }
  return true
}

// 回收僵尸：running 超时（崩溃/重启遗留）转 retrying 重投；排除本进程正在跑的 id。
async function reclaimZombies(pool: pg.Pool): Promise<void> {
  const inflight = [...(g.__childosJobInflight || [])].map(Number)
  await pool.query(
    `UPDATE job_queue SET status='retrying', run_after=NOW(), updated_at=NOW()
     WHERE status='running' AND updated_at < NOW() - ($1 || ' minutes')::interval
       AND ($2::bigint[] IS NULL OR id <> ALL($2::bigint[]))`,
    [ZOMBIE_MIN, inflight.length ? inflight : null]
  )
}

async function tick(): Promise<void> {
  const pool = jobPool()
  if (!pool) return
  const tickStart = Date.now()
  try {
    await ensureJobSchema(pool)
    await reclaimZombies(pool)
    let ran = 0
    for (let i = 0; i < BATCH; i++) {
      if (!(await claimAndRunOne(pool))) break
      ran++
    }
    // 积压/死信可观测，避免只入不出静默。
    const bl = await pool.query<{ n: number }>(`SELECT count(*)::int n FROM job_queue WHERE status IN ('pending','retrying') AND job_type <> '__heartbeat__'`)
    const fl = await pool.query<{ n: number }>(`SELECT count(*)::int n FROM job_queue WHERE status='failed' AND job_type <> '__heartbeat__'`)
    if (bl.rows[0].n > 100) console.warn(`[jobs] 积压 ${bl.rows[0].n}`)
    if (fl.rows[0].n > 0) console.error(`[jobs] 死信 failed=${fl.rows[0].n}`)
    // 独立 worker 心跳：证明本进程 poller 在动（web 关 poller 时不执行 tick，故不写）。
    await writeWorkerHeartbeat(pool)
    if (ran > 0) console.log(`[jobs] tick ran=${ran} backlog=${bl.rows[0].n} failed=${fl.rows[0].n} ms=${Date.now() - tickStart}`)
  } catch (err) {
    console.error('[jobs] tick 失败:', err)
  }
}

export function startJobPoller(): void {
  // 显式开关：CHILDOS_ENABLE_JOB_POLLER=false 时本进程不跑 poller（由独立 worker 进程承担）。
  if (process.env.CHILDOS_ENABLE_JOB_POLLER === 'false') return
  // dev 默认关（避免 HMR 闭包过期 + 多 worker）；显式 JOB_POLLER=true 可开。
  if (process.env.NODE_ENV !== 'production' && process.env.JOB_POLLER !== 'true') return
  if (!isDatabaseEnabled()) return
  if (g.__childosJobTimer) return // 守卫：只装一次
  g.__childosJobTimer = setInterval(() => {
    if (g.__childosJobTick) return // 串行守卫：上一轮未完跳过
    const watchdog = new Promise<void>(res => {
      const t = setTimeout(res, 5 * 60_000) // 看门狗：单轮 5min 超时释放守卫
      t.unref?.()
    })
    g.__childosJobTick = Promise.race([tick(), watchdog]).finally(() => { g.__childosJobTick = undefined })
  }, POLL_MS)
  g.__childosJobTimer.unref?.()
  console.log('[jobs] poller 已启动')
}

/* 独立 worker 心跳：每 tick 写一行 NOW()，readiness 据此判断 worker 是否真的在动。
   用 pg 条件 upsert（单行），跨进程可见。web 进程不写（poller 关闭时 tick 不执行）。 */
const HEARTBEAT_KEY = 'job_worker'

async function writeWorkerHeartbeat(pool: pg.Pool): Promise<void> {
  await pool.query(
    `INSERT INTO job_queue (job_type, payload, idempotency_key, status, updated_at)
     VALUES ('__heartbeat__', '{}'::jsonb, $1, 'succeeded', NOW())
     ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET updated_at = NOW()`,
    [`heartbeat:${HEARTBEAT_KEY}`]
  ).then(() => {/* ok */}).catch(err => console.warn('[jobs] 心跳写入失败:', err instanceof Error ? err.message : err))
}

export async function readWorkerHeartbeat(): Promise<{ at: string | null; ageMs: number | null }> {
  const pool = jobPool()
  if (!pool) return { at: null, ageMs: null }
  await ensureJobSchema(pool).catch(() => {})
  const r = await pool.query<{ updated_at: Date | string | null }>(
    `SELECT updated_at FROM job_queue WHERE idempotency_key = $1`,
    [`heartbeat:${HEARTBEAT_KEY}`]
  ).catch(() => ({ rows: [] as { updated_at: Date | string | null }[] }))
  const at = r.rows[0]?.updated_at
  if (!at) return { at: null, ageMs: null }
  const iso = at instanceof Date ? at.toISOString() : String(at)
  const ageMs = Date.now() - new Date(iso).getTime()
  return { at: iso, ageMs }
}

/** 全局积压/死信计数（readiness 门禁用，跨租户）。 */
export async function getGlobalJobBacklog(): Promise<{ pending: number; retrying: number; failed: number } | undefined> {
  const pool = jobPool()
  if (!pool) return undefined
  await ensureJobSchema(pool).catch(() => {})
  const r = await pool.query<{ status: string; n: number }>(
    `SELECT status, count(*)::int AS n FROM job_queue
     WHERE status IN ('pending','retrying','failed') AND job_type <> '__heartbeat__'
     GROUP BY status`
  ).catch(() => ({ rows: [] as { status: string; n: number }[] }))
  const out = { pending: 0, retrying: 0, failed: 0 }
  for (const row of r.rows) {
    if (row.status in out) (out as Record<string, number>)[row.status] = row.n
  }
  return out
}

/**
 * 登录强制补跑（混合监督 B）：
 * 1. 把本租户 failed 的 job 重置为 pending（上限 N），让 worker 重投。
 * 2. 强制排队 digest_update + model_review（桶 key 幂等，今天已排则 ON CONFLICT 跳过）——
 *    即使今天已跑过，只要有新 turn_events 也值得再检查（rebuildBrief 内 contentHash 短路兜底）。
 */
export async function forceLoginJobCheck(tenant: TenantId, maxReplay = 5): Promise<void> {
  if (!isDatabaseEnabled()) return
  const pool = jobPool()
  if (!pool) return
  await ensureJobSchema(pool).catch(() => {})

  const fam = tenant.familyId
  const FILTER = `COALESCE(payload->'tenant'->>'familyId', payload->'ctx'->>'familyId') = $1`
  // 重投 failed（排除心跳行）
  await pool.query(
    `UPDATE job_queue SET status='pending', last_error=NULL, run_after=NOW(), updated_at=NOW()
     WHERE id IN (
       SELECT id FROM job_queue
       WHERE status='failed' AND job_type <> '__heartbeat__' AND ${FILTER}
       ORDER BY id DESC
       LIMIT $2
     )`,
    [fam, maxReplay]
  ).catch(err => console.warn('[jobs] 登录补跑 failed 重投失败:', err))

  // 强制排队 digest + model_review + deep_mechanism
  // S2 开：daily_open 独立键，与 memory_write 日桶 / 10 轮里程碑不互跳过
  // S2 关：回退旧日桶键（与 memory_write 同日去重）
  await enqueueJob('digest_update', { tenant }, digestUpdateBucketKey(tenant), null).catch(() => {})
  await enqueueJob('model_review', { tenant }, modelReviewBucketKey(tenant), null).catch(() => {})
  const deepKey = isDeepMechanismS2Enabled()
    ? deepMechanismDailyOpenKey(tenant)
    : deepMechanismBucketKey(tenant)
  await enqueueJob('deep_mechanism_review', { tenant }, deepKey, null).catch(() => {})
}

/**
 * memory_ledger（基于 job_queue 的 trace_id 查询）：家长可见「这轮记住了没」。
 * job_queue 已按 trace_id 关联 memory_write + episode_ingest，无需单独建表。
 */
export type MemoryWriteStatus = {
  traceId: string
  memoryWrite?: { status: string; updatedAt: string }
  episodeIngest?: { status: string; updatedAt: string }
  /** 通俗文案：已记住 / 这次先记在对话里 / 正在整理 / 整理失败 */
  label: 'remembered' | 'in对话' | 'organizing' | 'failed' | 'unknown'
}

export async function getMemoryWriteStatusByTrace(traceId: string): Promise<MemoryWriteStatus | undefined> {
  const pool = jobPool()
  if (!pool) return undefined
  await ensureJobSchema(pool).catch(() => {})
  const r = await pool.query<{ job_type: string; status: string; updated_at: Date | string }>(
    `SELECT job_type, status, updated_at FROM job_queue
     WHERE trace_id = $1 AND job_type IN ('memory_write','episode_ingest')
     ORDER BY job_type, updated_at DESC`,
    [traceId]
  ).catch(() => ({ rows: [] as { job_type: string; status: string; updated_at: Date | string }[] }))

  const status: MemoryWriteStatus = { traceId, label: 'unknown' }
  const iso = (v: Date | string) => (v instanceof Date ? v.toISOString() : String(v))
  for (const row of r.rows) {
    if (row.job_type === 'memory_write') {
      status.memoryWrite = { status: row.status, updatedAt: iso(row.updated_at) }
    } else if (row.job_type === 'episode_ingest') {
      status.episodeIngest = { status: row.status, updatedAt: iso(row.updated_at) }
    }
  }

  const mw = status.memoryWrite?.status
  if (mw === 'succeeded') status.label = 'remembered'
  else if (mw === 'pending' || mw === 'running' || mw === 'retrying') status.label = 'organizing'
  else if (mw === 'failed') status.label = 'failed'
  else if (!mw) status.label = 'in对话' // 没排 memory_write = 轮次不值得进长期记忆，只在 turn_events 里
  return status
}

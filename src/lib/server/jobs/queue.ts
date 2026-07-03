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
import type { TenantId } from '@/lib/server/memory/tenant'
import type { MemoryWritePlan } from '@/types/database'

/* ================================================================
   Job Queue — 可靠后台任务队列（交付文档 14.3）
   PG 表 + in-process poller（pm2 单实例）。状态：pending/running/succeeded/failed/retrying。
   失败指数退避重试；幂等键去重；CAS 终态守卫；心跳防僵尸误判；DB 未启用→inline 降级。
   ================================================================ */

type JobType = 'memory_write' | 'episode_ingest' | 'digest_update' | 'entry_evidence' | 'model_review' | 'daily_deep'
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

// 两个 handler。executeWritePlan/ingestEpisodeStrict 内绝不吞异常，异常上抛驱动重试。
async function runJob(jobType: JobType, payload: unknown): Promise<void> {
  if (jobType === 'memory_write') {
    const p = payload as MemoryWritePayload
    await executeWritePlan(p.plan, p.tenant)
    // 链式触发 Brief/Board 更新（文档 12.1：后台写入→Brief→看板）。
    // null 键强制入队；真正去重靠 rebuildBriefAndBoard 内 content_hash 短路（同证据集空跑）。
    await enqueueJob('digest_update', { tenant: p.tenant }, null, null)
    // 写了待验证假设（综合/诊断后）→ 链式触发模型复核（反证收集+置信度，P2 后台深）。
    // 仅在有假设时触发，避免在 daily 等普通写入上空跑 LLM。复用每日桶 key → 每租户每天最多 1 次。
    if ((p.plan.pendingHypothesesToCreateOrUpdate?.length || 0) > 0) {
      await enqueueJob('model_review', { tenant: p.tenant }, modelReviewBucketKey(p.tenant), null)
    }
  } else if (jobType === 'episode_ingest') {
    const p = payload as EpisodeIngestPayload
    await ingestEpisodeStrict(p.text, p.ctx)
  } else if (jobType === 'digest_update') {
    const p = payload as DigestUpdatePayload
    await rebuildBriefAndBoard(p.tenant) // 幂等，重跑安全
  } else if (jobType === 'entry_evidence') {
    const p = payload as EntryEvidencePayload
    await runEntryEvidenceBuild(p) // 后台深度拆解入口证据包，不吞异常驱动重试
  } else if (jobType === 'model_review') {
    const p = payload as DigestUpdatePayload
    await runModelReview(p.tenant) // 复核待验证假设：反证+置信度，幂等可重跑
  } else if (jobType === 'daily_deep') {
    // 日常对话深拆：六维拆解 + 保守生成新假设。有新假设 → 走标准 memory_write
    // （→ 链式 model_review 完成反馈复盘）；无则 no-op，不空跑、不写库。
    const r = await runDailyDeep(payload as DailyDeepPayload)
    if (r) await enqueueJob('memory_write', { plan: r.plan, tenant: r.tenant }, null, null)
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
  // 心跳：长任务每 30s 推 updated_at，避免被僵尸回收误判。失败记日志（此前静默吞掉，连续失败会被误判僵尸却无从察觉）。
  const hb = setInterval(() => {
    void pool.query(`UPDATE job_queue SET updated_at=NOW() WHERE id=$1 AND status='running'`, [job!.id])
      .catch(err => console.warn(`[jobs] 心跳更新失败 id=${job!.id}:`, err instanceof Error ? err.message : err))
  }, 30_000)
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
  try {
    await ensureJobSchema(pool)
    await reclaimZombies(pool)
    for (let i = 0; i < BATCH; i++) {
      if (!(await claimAndRunOne(pool))) break
    }
    // 积压/死信可观测，避免只入不出静默。
    const bl = await pool.query<{ n: number }>(`SELECT count(*)::int n FROM job_queue WHERE status IN ('pending','retrying')`)
    const fl = await pool.query<{ n: number }>(`SELECT count(*)::int n FROM job_queue WHERE status='failed'`)
    if (bl.rows[0].n > 100) console.warn(`[jobs] 积压 ${bl.rows[0].n}`)
    if (fl.rows[0].n > 0) console.error(`[jobs] 死信 failed=${fl.rows[0].n}`)
  } catch (err) {
    console.error('[jobs] tick 失败:', err)
  }
}

export function startJobPoller(): void {
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

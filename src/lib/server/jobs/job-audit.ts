import 'server-only'

import pg from 'pg'
import { isDatabaseEnabled } from '@/lib/server/db'

type JobAuditGlobal = typeof globalThis & {
  __childosJobAuditPool?: pg.Pool
  __childosJobAuditSchemaReady?: Promise<void>
}

const g = globalThis as JobAuditGlobal

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
`

/** 监督/审计用小池，避免与 queue poller 争用同一连接标记。 */
export function jobPool(): pg.Pool | undefined {
  if (!isDatabaseEnabled()) return undefined
  if (!g.__childosJobAuditPool) {
    g.__childosJobAuditPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 30_000,
    })
  }
  return g.__childosJobAuditPool
}

export async function ensureJobSchemaForAudit(pool: pg.Pool): Promise<void> {
  if (!g.__childosJobAuditSchemaReady) {
    g.__childosJobAuditSchemaReady = pool.query(SCHEMA_SQL).then(() => undefined).catch((err) => {
      g.__childosJobAuditSchemaReady = undefined
      throw err
    })
  }
  await g.__childosJobAuditSchemaReady
}

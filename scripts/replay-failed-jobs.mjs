#!/usr/bin/env node
/**
 * 将失败的 memory_write / episode_ingest 任务重置为 pending 以便重试
 * 用法: node scripts/replay-failed-jobs.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.join(ROOT, '.env.local')
  const m = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)
  if (!m) throw new Error('缺少 DATABASE_URL')
  return m[1].replace(/^["']|["']$/g, '')
}

async function main() {
  const pool = new pg.Pool({ connectionString: loadDatabaseUrl() })
  const types = ['memory_write', 'episode_ingest', 'daily_deep']

  const { rows: failed } = await pool.query(
    `SELECT job_type, count(*)::int c FROM job_queue WHERE status='failed' AND job_type = ANY($1) GROUP BY 1`,
    [types]
  )
  console.log('failed by type:', failed)

  const { rows: samples } = await pool.query(
    `SELECT job_type, left(last_error, 120) err FROM job_queue WHERE status='failed' ORDER BY updated_at DESC LIMIT 5`
  )
  console.log('recent errors:', samples)

  if (DRY_RUN) {
    const { rows: count } = await pool.query(
      `SELECT count(*)::int c FROM job_queue WHERE status='failed' AND job_type = ANY($1)`,
      [types]
    )
    console.log(`dry-run: would reset ${count[0]?.c || 0} jobs`)
    await pool.end()
    return
  }

  const res = await pool.query(
    `UPDATE job_queue SET status='pending', attempts=0, run_after=NOW(), last_error=NULL, updated_at=NOW()
     WHERE status='failed' AND job_type = ANY($1)`,
    [types]
  )
  console.log(`reset ${res.rowCount} failed jobs to pending`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * 一次性迁移：将 built_profile_snapshots 中的占位 coreJudgment 改写为家长可读标题
 *
 * 用法:
 *   node scripts/migrate-humanize-profile-titles.mjs --dry-run
 *   node scripts/migrate-humanize-profile-titles.mjs
 *   DATABASE_URL=postgres://... node scripts/migrate-humanize-profile-titles.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

const PLACEHOLDER_RE =
  /测试画像|生命周期测试|画像\s*ID|profile[_\s-]?id|^\d{10,}$|178\d{6,}|[A-Za-z0-9]{8,}测试/i

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('缺少 DATABASE_URL 或 .env.local')
  const m = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)
  if (!m) throw new Error('.env.local 中未找到 DATABASE_URL')
  return m[1].replace(/^["']|["']$/g, '')
}

function isPlaceholder(text) {
  const t = text?.trim()
  if (!t || t.length < 6) return true
  return PLACEHOLDER_RE.test(t)
}

function humanReadableHeadline(fallback = {}) {
  const candidates = [fallback.mechanism, fallback.pattern, fallback.hypothesis, fallback.fallback].filter(Boolean)
  for (const raw of candidates) {
    const cleaned = String(raw).replace(/^还在验证：?/, '').trim()
    if (!cleaned || isPlaceholder(cleaned)) continue
    if (cleaned.length <= 40) return cleaned
    return `${cleaned.slice(0, 40).replace(/[，,；;：:]$/, '')}…`
  }
  return '一进入检查或反馈流程，他容易先防御'
}

function humanizeSnapshot(data) {
  if (!data || typeof data !== 'object') return { changed: false, data }
  const core = data.coreJudgment
  if (!isPlaceholder(core)) return { changed: false, data }

  const fromDeep = String(data.deepMechanism || '')
    .split('\n')
    .map((l) => l.replace(/^家长常见动作：/, '').trim())
    .find((l) => l.length > 8)

  const next = {
    ...data,
    coreJudgment: humanReadableHeadline({
      mechanism: data.supportFocus,
      pattern: fromDeep,
      fallback: '一进入检查或反馈流程，他容易先进入防御',
    }),
    migratedAt: new Date().toISOString(),
    migratedFrom: typeof core === 'string' ? core.slice(0, 80) : undefined,
  }
  return { changed: true, data: next }
}

async function main() {
  const pool = new pg.Pool({ connectionString: loadDatabaseUrl() })
  const { rows } = await pool.query(
    `SELECT family_id, child_id, item_id, data
     FROM memory_layer_items
     WHERE layer_name = 'built_profile_snapshots'`
  )

  let scanned = 0
  let changed = 0
  const samples = []

  for (const row of rows) {
    scanned += 1
    const { changed: didChange, data } = humanizeSnapshot(row.data)
    if (!didChange) continue
    changed += 1
    samples.push({ family_id: row.family_id, child_id: row.child_id, before: row.data?.coreJudgment, after: data.coreJudgment })

    if (!DRY_RUN) {
      await pool.query(
        `UPDATE memory_layer_items
         SET data = $1::jsonb, updated_at = NOW()
         WHERE family_id = $2 AND child_id = $3 AND layer_name = 'built_profile_snapshots' AND item_id = $4`,
        [JSON.stringify(data), row.family_id, row.child_id, row.item_id]
      )
    }
  }

  await pool.end()

  console.log(`\n=== humanize built_profile_snapshots ${DRY_RUN ? '(dry-run)' : ''} ===`)
  console.log(`scanned=${scanned} changed=${changed}`)
  for (const s of samples.slice(0, 8)) {
    console.log(`- ${s.family_id}/${s.child_id}`)
    console.log(`  before: ${s.before}`)
    console.log(`  after:  ${s.after}`)
  }
  if (changed === 0) console.log('无需迁移')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

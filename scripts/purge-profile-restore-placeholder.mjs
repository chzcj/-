#!/usr/bin/env node
/**
 * 清理 DB 中「家庭画像已从服务器记录恢复」等历史占位文案。
 * 用法：node scripts/purge-profile-restore-placeholder.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

const BAD_RE =
  /从服务器记录恢复|家庭画像已从服务器记录恢复|继续交流即可补充细节|测试画像|生命周期测试/i

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('缺少 DATABASE_URL 或 .env.local')
  const m = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)
  if (!m) throw new Error('.env.local 中未找到 DATABASE_URL')
  return m[1].replace(/^["']|["']$/g, '')
}

function isBad(text) {
  const t = String(text || '').trim()
  return t && BAD_RE.test(t)
}

async function main() {
  const pool = new pg.Pool({ connectionString: loadDatabaseUrl() })
  let builtFixed = 0
  let uiCleared = 0

  const builtRows = await pool.query(
    `SELECT family_id, child_id, item_id, data FROM memory_layer_items WHERE layer_name = 'built_profile_snapshots'`
  )
  for (const row of builtRows.rows) {
    const data = row.data
    if (!data || !isBad(data.coreJudgment)) continue
    const next = {
      ...data,
      coreJudgment: '',
      purgedRestorePlaceholderAt: new Date().toISOString(),
      purgedFrom: String(data.coreJudgment).slice(0, 120),
    }
    builtFixed++
    if (!DRY_RUN) {
      await pool.query(
        `UPDATE memory_layer_items SET data = $1::jsonb WHERE family_id = $2 AND child_id = $3 AND layer_name = 'built_profile_snapshots' AND item_id = $4`,
        [JSON.stringify(next), row.family_id, row.child_id, row.item_id]
      )
    }
    console.log(`[built] ${row.family_id}/${row.child_id}: ${String(data.coreJudgment).slice(0, 60)}…`)
  }

  const uiRows = await pool.query(
    `SELECT family_id, child_id, item_id, data FROM memory_layer_items WHERE layer_name = 'daily_ui_snapshot'`
  )
  for (const row of uiRows.rows) {
    const data = row.data
    const cards = data?.portraitCards || {}
    const bad = Object.values(cards).some((v) => isBad(v))
    if (!bad) continue
    uiCleared++
    if (!DRY_RUN) {
      await pool.query(
        `DELETE FROM memory_layer_items WHERE family_id = $1 AND child_id = $2 AND layer_name = 'daily_ui_snapshot' AND item_id = $3`,
        [row.family_id, row.child_id, row.item_id]
      )
    }
    console.log(`[daily_ui_snapshot] cleared ${row.family_id}/${row.child_id}`)
  }

  console.log(`\n=== purge ${DRY_RUN ? '(dry-run)' : ''} ===`)
  console.log(`built_profile_snapshots fixed: ${builtFixed}`)
  console.log(`daily_ui_snapshot cleared: ${uiCleared}`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

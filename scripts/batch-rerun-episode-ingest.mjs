#!/usr/bin/env node
/**
 * 批量重跑 episode_ingest（排除寒暄；有 LLM 成本）
 * 用法：npx tsx scripts/batch-rerun-episode-ingest.mjs [familyId] [childId] [--dry-run] [--limit=N]
 */
const args = process.argv.slice(2)
const familyId = args.find((a) => !a.startsWith('--')) || 'f_demo'
const childId = args.filter((a) => !a.startsWith('--'))[1] || 'c_demo'
const dryRun = args.includes('--dry-run')
const limitArg = args.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined

const base = (process.env.YUJIAN_BASE || 'https://yujian.yihe.site').replace(/\/$/, '')
const token = process.env.INTERNAL_API_TOKEN || process.env.AUTH_TOKEN || ''

if (!token) {
  console.error('缺少 INTERNAL_API_TOKEN 或 AUTH_TOKEN')
  process.exit(1)
}

console.log('[episode-reingest]', { familyId, childId, dryRun, limit, base })
const t0 = Date.now()

const res = await fetch(`${base}/api/internal/episode-reingest`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ familyId, childId, dryRun, limit }),
})

const json = await res.json().catch(() => ({}))
console.log('[episode-reingest] status=', res.status, 'body=', JSON.stringify(json), 'elapsed_ms=', Date.now() - t0)
process.exit(res.ok && json.ok ? 0 : 1)

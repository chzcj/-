#!/usr/bin/env node
/**
 * 批量重跑 dialogueAnalysisV2（缺 rehearsal_seed.v2 的 done 记录；有 LLM 成本）
 * 用法：npx tsx scripts/batch-rerun-dialogue-analysis.mjs [familyId] [childId] [--dry-run] [--limit=N] [--all]
 *
 * --all：含已有 v2 的记录也重跑（默认只跑缺 v2）
 */
const args = process.argv.slice(2)
const positional = args.filter((a) => !a.startsWith('--'))
const familyId = positional[0] || 'f_demo'
const childId = positional[1] || 'c_demo'
const dryRun = args.includes('--dry-run')
const onlyMissingV2 = !args.includes('--all')
const limitArg = args.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined

const base = (process.env.YUJIAN_BASE || 'https://yujian.yihe.site').replace(/\/$/, '')
const token = process.env.INTERNAL_API_TOKEN || process.env.AUTH_TOKEN || ''

if (!token) {
  console.error('缺少 INTERNAL_API_TOKEN 或 AUTH_TOKEN')
  process.exit(1)
}

console.log('[dialogue-reanalyze]', { familyId, childId, dryRun, onlyMissingV2, limit, base })
const t0 = Date.now()

const res = await fetch(`${base}/api/internal/dialogue-reanalyze`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ familyId, childId, dryRun, onlyMissingV2, limit }),
})

const json = await res.json().catch(() => ({}))
console.log(
  '[dialogue-reanalyze] status=',
  res.status,
  'body=',
  JSON.stringify(json, null, 2),
  'elapsed_ms=',
  Date.now() - t0
)
process.exit(res.ok && json.ok ? 0 : 1)

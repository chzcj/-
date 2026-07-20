#!/usr/bin/env node
/**
 * 手账历史回填（调内部 API，避免 server-only 脚本限制）
 * 用法：npx tsx scripts/backfill-handbook-pages.mjs [familyId] [childId]
 * 环境：INTERNAL_API_TOKEN 或 AUTH_TOKEN；可选 YUJIAN_BASE（默认 https://yujian.yihe.site）
 */
const familyId = process.argv[2] || 'f_demo'
const childId = process.argv[3] || 'c_demo'
const base = (process.env.YUJIAN_BASE || 'https://yujian.yihe.site').replace(/\/$/, '')
const token = process.env.INTERNAL_API_TOKEN || process.env.AUTH_TOKEN || ''

if (!token) {
  console.error('缺少 INTERNAL_API_TOKEN 或 AUTH_TOKEN')
  process.exit(1)
}

console.log('[handbook-backfill] tenant=', { familyId, childId }, 'base=', base)
const t0 = Date.now()

const res = await fetch(`${base}/api/internal/handbook-backfill`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    familyId,
    childId,
    fullRefresh: process.argv.includes('--full'),
  }),
})

const json = await res.json().catch(() => ({}))
console.log('[handbook-backfill] status=', res.status, 'body=', JSON.stringify(json), 'elapsed_ms=', Date.now() - t0)
if (res.ok && json.ok && json.data?.enqueued) {
  console.log('[handbook-backfill] 已入队，job worker 异步执行；可用 diag-handbook-admission.mjs 查看进度')
}
process.exit(res.ok && json.ok ? 0 : 1)

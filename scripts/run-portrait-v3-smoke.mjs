#!/usr/bin/env node
/**
 * 生产/本地 smoke：PORTRAIT_V3=1 跑一轮 runDeepMechanismReview
 * 用法（服务器）：
 *   cd /home/ubuntu/apps/yujian
 *   export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
 *   export PORTRAIT_V3=1
 *   npx tsx scripts/run-portrait-v3-smoke.mjs [familyId] [childId]
 */
import { runDeepMechanismReview } from '../src/lib/server/memory/deep-mechanism/pipeline.ts'

const familyId = process.argv[2] || 'f_demo'
const childId = process.argv[3] || 'c_demo'
const tenant = { familyId, childId }

console.log('[portrait-v3-smoke] tenant=', tenant, 'PORTRAIT_V3=', process.env.PORTRAIT_V3)
const t0 = Date.now()

const wrote = await runDeepMechanismReview(tenant, {
  reason: 'build_complete',
  forceFull: true,
})

console.log('[portrait-v3-smoke] wrote=', wrote, 'elapsed_ms=', Date.now() - t0)
process.exit(wrote ? 0 : 2)

#!/usr/bin/env node
/**
 * 检索 packet → FrontendReadPack 静态契约（防回归）
 * 运行：node scripts/test-retrieval-packet.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

let pass = 0
let fail = 0
const assert = (c, m) => {
  c ? pass++ : (fail++, console.error('  ✗', m))
}

console.log('=== retrieval packet 契约测试 ===\n')

// 1. router 构建 entryFacts 直喂
{
  const src = read('src/lib/server/memory/retrieval/router.ts')
  assert(src.includes('entryFacts'), 'router 产出 entryFacts 字段')
  assert(src.includes('verifiableFacts'), 'entryFacts 来自 verifiableFacts')
  assert(src.includes('childBehaviors'), 'entryFacts 来自 childBehaviors')
  assert(src.includes('triggerPoints'), 'entryFacts 来自 triggerPoints')
}

// 2. matchedMechanisms 阈值：排除 low，不是仅 high
{
  const src = read('src/lib/server/memory/retrieval/router.ts')
  assert(
    src.includes("overallStrength !== 'low'"),
    'matchedMechanisms 过滤 overallStrength !== low'
  )
  assert(
    !/matchedMechanisms:.*overallStrength\s*===\s*'high'/.test(src.split('buildDailyDialogueRetrievalPacket')[1]?.split('return {')[0] || ''),
    'daily dialogue packet 不以 ===high 作为唯一门槛（粗检）'
  )
}

// 3. familyPatterns 来自 L7
{
  const src = read('src/lib/server/memory/retrieval/router.ts')
  assert(src.includes('getFamilyInteractionCycles'), 'router 读 L7 cycles')
  assert(src.includes('familyInteractionPatterns'), 'packet 字段 familyInteractionPatterns')
}

// 4. orchestration 映射 retrievedContext 含 entryFacts
{
  const src = read('src/lib/server/orchestration/pipeline.ts')
  assert(src.includes('entryFacts: retrievalPacket.entryFacts'), 'orchestration 透传 entryFacts')
}

// 5. prose 经 pickFrontendReadPack，childQuotes 不进 pack
{
  const prose = read('src/lib/server/daily/prose-context.ts')
  const pack = read('src/lib/server/daily/frontend-read-pack.ts')
  assert(prose.includes('pickFrontendReadPack'), 'prose-context 使用 pickFrontendReadPack')
  const keysBlock = pack.slice(pack.indexOf('FRONTEND_READ_PACK_KEYS'), pack.indexOf('] as const', pack.indexOf('FRONTEND_READ_PACK_KEYS')) + 9)
  assert(keysBlock.includes('childQuotes'), 'FRONTEND_READ_PACK_KEYS 含 childQuotes（read-contract.md 动态字段）')
  assert(pack.includes('BACKEND_ONLY_CONTEXT_FIELDS'), '声明后端专用上下文字段')
}

// 6. parent narrative 有写路径
{
  const de = read('src/lib/server/memory/write/decision-engine.ts')
  const dm = read('src/lib/server/memory/deep-mechanism/pipeline.ts')
  assert(de.includes('saveParentNarrativePattern'), 'decision-engine 写 parent_narrative')
  assert(dm.includes('saveParentNarrativePattern'), 'deep_mechanism pipeline 写 parent_narrative')
}

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`)
process.exit(fail === 0 ? 0 : 1)

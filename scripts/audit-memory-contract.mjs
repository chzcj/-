#!/usr/bin/env node
/**
 * 记忆读写契约审计（防幻觉）：静态校验「写了的层一定被读 / 读了的层一定有写路径」。
 * 任一断言失败 → exit 1，CI 应阻止上线。
 *
 * 覆盖：
 *  E1 死层停写：executeWritePlan 中 saveRawMaterials/saveCleanedFacts/saveRetrievalIndexes 必须被
 *     writeDeadLayers(=CHILDOS_WRITE_DEAD_LAYERS) 开关包裹，禁止无条件写。
 *  E2 parent_narrative 写路径：executeWritePlan 必须调用 saveParentNarrativePattern（router 读该层）。
 *  E3 router 不读死层：retrieval/router.ts 不得 load/get raw_materials|cleaned_facts|retrieval_indexes。
 *  E4 entry_evidence 链：queue.ts 的 entry_evidence 分支必须 enqueue digest_update + model_review。
 *  E5 选择性 L1 gate：stream/route.ts 必须对 light_response 短寒暄跳过 memory_write。
 *  E6 episode 选择性：stream/route.ts 仅在 counter_evidence 等高价值轮 enqueue episode_ingest，
 *     不得无条件每轮入队。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

let failures = 0
function assert(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`)
    failures++
  } else {
    console.log(`  ✓ ${msg}`)
  }
}

console.log('audit:memory-contract — 记忆读写契约审计')

// E1 死层停写
{
  const src = read('src/lib/server/memory/write/decision-engine.ts')
  const writePlanFn = src.slice(src.indexOf('export async function executeWritePlan'))
  const deadCalls = ['saveRawMaterials', 'saveCleanedFacts', 'saveRetrievalIndexes']
  for (const fn of deadCalls) {
    const occurrences = writePlanFn.split(fn).length - 1
    assert(occurrences === 0 || writePlanFn.includes('writeDeadLayers'),
      `E1 ${fn} 调用必须被 writeDeadLayers 开关包裹`)
  }
  // 进一步：每个死层调用应出现在 writeDeadLayers 为 true 的分支内（粗检：if (writeDeadLayers ...) 块）
  assert(/if \(writeDeadLayers[^]*saveRawMaterials/.test(writePlanFn.replace(/\n\s*\n/g, '\n')) || !writePlanFn.includes('saveRawMaterials'),
    'E1 saveRawMaterials 必须在 writeDeadLayers 分支内')
}

// E2 parent_narrative 写路径
{
  const src = read('src/lib/server/memory/write/decision-engine.ts')
  const writePlanFn = src.slice(src.indexOf('export async function executeWritePlan'))
  assert(writePlanFn.includes('saveParentNarrativePattern'),
    'E2 executeWritePlan 必须调用 saveParentNarrativePattern（router 读该层）')
}

// E3 router 不读死层
{
  const src = read('src/lib/server/memory/retrieval/router.ts')
  assert(!/getRawMaterials|loadMemoryLayerItems\(\s*['"]raw_materials/.test(src),
    'E3 router 不得读取 raw_materials')
  assert(!/getCleanedFacts|loadMemoryLayerItems\(\s*['"]cleaned_facts/.test(src),
    'E3 router 不得读取 cleaned_facts')
  assert(!/getRetrievalIndexes|loadMemoryLayerItems\(\s*['"]retrieval_indexes/.test(src),
    'E3 router 不得读取 retrieval_indexes')
}

// E4 entry_evidence 链
{
  const src = read('src/lib/server/jobs/queue.ts')
  const entryBranch = src.slice(src.indexOf("jobType === 'entry_evidence'"), src.indexOf("jobType === 'model_review'"))
  assert(entryBranch.includes("enqueueJob('digest_update'"),
    'E4 entry_evidence 必须链式 enqueue digest_update')
  assert(entryBranch.includes("enqueueJob('model_review'"),
    'E4 entry_evidence 必须链式 enqueue model_review')
}

// E5 选择性 L1 gate + 批量 memory_write（满 10 轮或反证 flush）
{
  const src = read('app/api/daily/stream/route.ts')
  assert(/isLight\s*=\s*frontResponseType\s*===\s*['"]light_response['"]/.test(src),
    'E5 stream 必须识别 light_response')
  assert(/isShortGreeting\s*=\s*isLight\s*&&\s*text\.length\s*<\s*\d+/.test(src),
    'E5 stream 必须对短寒暄跳过 L1 写入')
  assert(/shouldWriteL1\s*=\s*[^;]*!isShortGreeting/.test(src),
    'E5 shouldWriteL1 必须排除 isShortGreeting')
  assert(/stageDailyUpdateForMemoryWrite/.test(src),
    'E5 stream 必须使用 batched stageDailyUpdateForMemoryWrite')
}

// E6 有效 daily 入 Episode 队列，寒暄短句跳过
{
  const src = read('app/api/daily/stream/route.ts')
  assert(/shouldSkipEpisodeIngest/.test(src), 'E6 stream 必须使用 shouldSkipEpisodeIngest')
  assert(
    /if\s*\(shouldWriteL1\s*&&\s*!shouldSkipEpisodeIngest/.test(src) &&
      /enqueueJob\(['"]episode_ingest['"]/.test(src),
    'E6 stream 必须在有效轮且非寒暄时 enqueue episode_ingest'
  )
  const episodeIdx = src.indexOf("enqueueJob('episode_ingest'")
  const preceding = src.slice(Math.max(0, episodeIdx - 400), episodeIdx)
  assert(preceding.includes('episodeId') && preceding.includes('shouldWriteL1'),
    'E6 episode_ingest 必须使用有效轮 gate 与确定性 episodeId')
}

// E7 前端 AI 读取门控：prose-context 必须经 pickFrontendReadPack
{
  const prose = read('src/lib/server/daily/prose-context.ts')
  assert(prose.includes('pickFrontendReadPack'), 'E7 prose-context 必须使用 pickFrontendReadPack')
  assert(
    read('src/lib/server/daily/frontend-read-pack.ts').includes('FRONTEND_READ_PACK_KEYS'),
    'E7 frontend-read-pack 模块存在'
  )
}

if (failures > 0) {
  console.error(`\n审计失败：${failures} 项契约违反，禁止上线。`)
  process.exit(1)
}
console.log('\n审计通过：所有记忆读写契约满足。')

#!/usr/bin/env node
/**
 * 静态验证：条件画像读取统一走 .childTendency 字符串，禁止把 ConditionalProfile 对象塞进 LLM。
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

console.log('verify:conditional-profile-reads — 条件画像读取门控\n')

// 1. router 取 childTendency
{
  const src = read('src/lib/server/memory/retrieval/router.ts')
  assert(
    /primaryConditionalProfile\?\.childTendency/.test(src),
    'router 使用 primaryConditionalProfile?.childTendency'
  )
  assert(
    !src.includes('relevantChildStructureModels.push(model.primaryConditionalProfile)'),
    'router 未 push 整个 ConditionalProfile 对象进画像数组'
  )
}

// 2. profile-rewrite 取 childTendency
{
  const src = read('src/lib/server/profile-rewrite.ts')
  assert(
    src.includes('primaryConditionalProfile?.childTendency'),
    'profile-rewrite 使用 primaryConditionalProfile?.childTendency'
  )
  assert(
    src.includes('禁止把对象塞进 LLM') || src.includes('避免把对象塞进 LLM'),
    'profile-rewrite 有对象禁止注释'
  )
}

// 3. frontend-read-pack 只输出 string[]
{
  const src = read('src/lib/server/daily/frontend-read-pack.ts')
  assert(src.includes('全部为 string[]'), 'frontend-read-pack 声明 string[] only')
  assert(src.includes('childStructureModels'), '含 childStructureModels 槽位')
}

// 4. synthesis 草案是 string，L5 是对象（类型分离）
{
  const src = read('src/types/database.ts')
  const draftBlock = src.slice(src.indexOf('childStructureModelDraft'), src.indexOf('childStructureModelDraft') + 400)
  assert(/primaryConditionalProfile:\s*string/.test(draftBlock), 'draft.primaryConditionalProfile 为 string')
  const modelBlock = src.slice(src.indexOf('export interface ChildStructureModel'), src.indexOf('export interface ChildStructureModel') + 500)
  assert(/primaryConditionalProfile:\s*ConditionalProfile/.test(modelBlock), 'L5 primaryConditionalProfile 为 ConditionalProfile 对象')
}

// 5. family interaction 读取走 L7 → familyPatterns
{
  const src = read('src/lib/server/memory/retrieval/router.ts')
  assert(src.includes('getFamilyInteractionCycles'), 'router 读 L7 cycles')
  assert(src.includes('familyInteractionPatterns'), 'router 产出 familyInteractionPatterns')
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)

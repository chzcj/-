#!/usr/bin/env node
/**
 * profile_build_run 核心 LLM 耗时 A/B：thinking 开 vs 关（synthesis + diagnosis）。
 * 不修改产品代码；直连 FAST_AI，用生产 DB 四模块证据包。
 *
 * 用法（生产机）：
 *   ENV_FILE=.env.local node scripts/benchmark-profile-build-thinking.mjs
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const ENTRY_NAMES = [
  'daily_rhythm_phone',
  'learning_homework',
  'parent_child_communication',
  'relationship_environment',
]

function loadEnv() {
  const envPath = process.env.ENV_FILE || path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

async function loadPromptRegistry() {
  const mod = await import(
    pathToFileURL(path.join(ROOT, 'src/lib/server/prompts/registry.generated.ts')).href
  )
  return mod.promptRegistry
}

function buildSynthesisSystem(prompts) {
  return [prompts.secondMeCollaboratorIdentity, prompts.entryBuildStyle, prompts.profileBuildSynthesis]
    .filter(Boolean)
    .join('\n\n---\n\n')
}

function buildDiagnosisSystem(prompts) {
  return [prompts.parentFacingStyle, prompts.entryBuildStyle, prompts.profileBuildDiagnosis]
    .filter(Boolean)
    .join('\n\n---\n\n')
}

async function fetchFourPacks(pool) {
  const family = process.env.BENCH_FAMILY
  if (family) {
    const r = await pool.query(
      `SELECT data FROM memory_layer_items
       WHERE layer_name = 'entry_evidence_packs' AND family_id = $1
       AND data->>'entryName' = ANY($2::text[])`,
      [family, ENTRY_NAMES],
    )
    if (r.rows.length >= 4) return { familyId: family, packs: r.rows.map((x) => x.data) }
  }

  const r = await pool.query(
    `SELECT family_id FROM (
       SELECT family_id, COUNT(DISTINCT data->>'entryName') AS n
       FROM memory_layer_items
       WHERE layer_name = 'entry_evidence_packs'
         AND data->>'entryName' = ANY($1::text[])
       GROUP BY family_id
       HAVING COUNT(DISTINCT data->>'entryName') >= 4
       ORDER BY n DESC
       LIMIT 1
     ) t`,
    [ENTRY_NAMES],
  )
  if (!r.rows[0]) throw new Error('未找到四模块齐的 entry_evidence_packs')
  const fid = r.rows[0].family_id
  const packs = await pool.query(
    `SELECT data FROM memory_layer_items
     WHERE layer_name = 'entry_evidence_packs' AND family_id = $1
       AND data->>'entryName' = ANY($2::text[])`,
    [fid, ENTRY_NAMES],
  )
  return { familyId: fid, packs: packs.rows.map((x) => x.data) }
}

function packSummaries(packs) {
  return packs.map((p) => ({
    entryName: p.entryName,
    stageSummary: p.handoffToSummaryAgent?.mostLikelyLocalMechanisms?.join('；') || p.rawInputSummary,
    rawInputSummary: (p.rawInputSummary || '').slice(0, 1200),
    keyFacts: (p.decomposedInput?.verifiableFacts || []).slice(0, 12),
    keyBehaviors: (p.decomposedInput?.childBehaviors || []).slice(0, 12),
    keyTriggers: (p.decomposedInput?.triggerPoints || []).slice(0, 8),
    keyParentActions: (p.decomposedInput?.parentActions || []).slice(0, 8),
    handoffEvidence: p.handoffToSummaryAgent?.mostImportantEvidence || [],
  }))
}

async function callJson({ system, user, maxTokens, disableThinking }) {
  const apiKey = process.env.FAST_AI_API_KEY
  const model = process.env.FAST_AI_MODEL
  const base = (process.env.FAST_AI_BASE_URL || '').replace(/\/$/, '')
  const temp = Number(process.env.FAST_AI_TEMPERATURE || 0.7)
  if (!apiKey || !model || !base) throw new Error('FAST_AI not configured')

  const t0 = Date.now()
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: temp,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      ...(disableThinking ? { thinking: { type: 'disabled' } } : {}),
    }),
  })
  const responseMs = Date.now() - t0
  if (!response.ok) {
    const msg = await response.text().catch(() => '')
    throw new Error(`LLM ${response.status}: ${msg.slice(0, 400)}`)
  }
  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { parseError: true, raw: text.slice(0, 300) }
  }
  return { responseMs, parsed, usage: data.usage }
}

function synthesisTask(entrySummaries) {
  return `四模块首次画像综合建模（daily / homework / communication / family）。请进行跨模块综合分析。

核心任务：
1. 找出跨多个模块重复出现的孩子行为模式和家长触发动作
2. 找出跨场景的孩子保护策略
3. 识别家庭互动循环
4. 生成条件化孩子结构模型草案
5. 准备给深层诊断 Agent 的诊断材料包

规则：不能把家长评价写成孩子事实；不能停在中间变量。
crossEntryEvidenceMap 材料足够时 8–12 条；candidateMechanismMatrix 10–15 条。
输出完整 JSON，不要省略字段。`
}

function diagnosisTask(syn, facts) {
  const handoff = syn?.diagnosisHandoffPackage || null
  const mechanismSummaries = (syn?.candidateMechanismMatrix || []).slice(0, 8).map((m) => ({
    name: m.mechanismName,
    strength: m.overallStrength,
    evidence: (m.supportingEvidence || []).slice(0, 3),
  }))
  return `深层诊断 Agent。生成最终诊断 JSON，所有字段必填。

诊断交接包：${JSON.stringify(handoff)}
候选机制：${JSON.stringify(mechanismSummaries)}
可验证事实：${JSON.stringify(facts.slice(0, 16))}`
}

function scoreSyn(parsed) {
  if (!parsed || parsed.parseError) return { ok: false, cross: 0, mech: 0 }
  const cross = Array.isArray(parsed.crossEntryEvidenceMap) ? parsed.crossEntryEvidenceMap.length : 0
  const mech = Array.isArray(parsed.candidateMechanismMatrix) ? parsed.candidateMechanismMatrix.length : 0
  return { ok: cross >= 1 && mech >= 1, cross, mech }
}

function scoreDiag(parsed) {
  if (!parsed || parsed.parseError) return { ok: false }
  const chain = parsed.primaryMechanismChain
  const profiles = parsed.secondMeConditionalProfile
  return {
    ok: Boolean(chain?.parentAction) && Array.isArray(profiles) && profiles.length > 0,
    profileCount: Array.isArray(profiles) ? profiles.length : 0,
  }
}

loadEnv()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prompts = await loadPromptRegistry()
const synSystem = buildSynthesisSystem(prompts)
const diagSystem = buildDiagnosisSystem(prompts)
const { familyId, packs } = await fetchFourPacks(pool)
const entrySummaries = packSummaries(packs)
const synMax = Number(process.env.FAST_AI_SYNTHESIS_MAX_TOKENS || 8192)
const diagMax = Number(process.env.FAST_AI_DIAGNOSIS_MAX_TOKENS || 8192)

console.log(`\n=== profile_build LLM benchmark ===`)
console.log(`family=${familyId} packs=${packs.length} synMax=${synMax} diagMax=${diagMax}`)
console.log(`生产 profile_build_run job 参考：2026-07-17 单次 succeeded ≈270s（含 synthesis+diagnosis+persist+readiness，thinking 默认开）\n`)

const results = []

for (const disableThinking of [false, true]) {
  const label = disableThinking ? 'thinking OFF' : 'thinking ON (prod default for syn/diag)'
  console.log(`--- ${label} ---`)

  const synUser = `只输出 JSON。\n\n${synthesisTask(entrySummaries)}\n\n输入：\n${JSON.stringify({
    task: synthesisTask(entrySummaries),
    entryPacks: entrySummaries,
    completedCount: 4,
    maturityLevel: 'L2',
    moduleKeys: ['daily', 'homework', 'communication', 'family'],
  })}`

  const syn = await callJson({ system: synSystem, user: synUser, maxTokens: synMax, disableThinking })
  const synScore = scoreSyn(syn.parsed)
  console.log(`  synthesis: ${(syn.responseMs / 1000).toFixed(1)}s cross=${synScore.cross} mech=${synScore.mech} parse=${synScore.ok}`)

  const facts = entrySummaries.flatMap((e) => e.keyFacts)
  const diagUser = `只输出 JSON。\n\n${diagnosisTask(syn.parsed, facts)}`
  const diag = await callJson({ system: diagSystem, user: diagUser, maxTokens: diagMax, disableThinking })
  const diagScore = scoreDiag(diag.parsed)
  console.log(`  diagnosis: ${(diag.responseMs / 1000).toFixed(1)}s profiles=${diagScore.profileCount} parse=${diagScore.ok}`)
  console.log(`  LLM 合计: ${((syn.responseMs + diag.responseMs) / 1000).toFixed(1)}s (+ persist/readiness 另计 ~15s)\n`)

  results.push({
    label,
    disableThinking,
    synMs: syn.responseMs,
    diagMs: diag.responseMs,
    totalLlmMs: syn.responseMs + diag.responseMs,
    synScore,
    diagScore,
  })
}

const on = results.find((r) => !r.disableThinking)
const off = results.find((r) => r.disableThinking)
if (on && off) {
  const saved = on.totalLlmMs - off.totalLlmMs
  console.log('=== 对比 ===')
  console.log(`thinking ON  LLM: ${(on.totalLlmMs / 1000).toFixed(1)}s`)
  console.log(`thinking OFF LLM: ${(off.totalLlmMs / 1000).toFixed(1)}s`)
  console.log(`节省: ${(saved / 1000).toFixed(1)}s (${((saved / on.totalLlmMs) * 100).toFixed(0)}%)`)
  console.log(`粗估全链 ON:  ${(270).toFixed(0)}s (生产实测 job)`)
  console.log(`粗估全链 OFF: ${Math.max(60, 270 - saved / 1000).toFixed(0)}s (按 LLM 差值外推，非精确)`)
}

await pool.end()

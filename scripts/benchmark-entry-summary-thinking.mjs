#!/usr/bin/env node
/**
 * 对比模块总结：thinking 开 vs 关（DeepSeek，生产 prompt + 生产库样本）。
 * 纯 mjs，不 import server-only 模块。
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const ENTRY_NAME_MAP = {
  daily: 'daily_rhythm_phone',
  homework: 'learning_homework',
  communication: 'parent_child_communication',
  family: 'relationship_environment',
}

const TITLE_MAP = {
  daily: '日常节奏',
  homework: '学习作业',
  communication: '亲子沟通',
  family: '家庭支持',
}

const SUMMARY_AGENT = {
  daily: 'entryDailySummary',
  homework: 'entryHomeworkSummary',
  communication: 'entryCommunicationSummary',
  family: 'entryFamilySummary',
}

async function loadPromptRegistry() {
  const mod = await import(pathToFileURL(path.join(ROOT, 'src/lib/server/prompts/registry.generated.ts')).href)
  return mod.promptRegistry
}

function buildEntryAnalyzeSystem(agentPrompts, agentKey) {
  return [agentPrompts.parentFacingStyle, agentPrompts.entryBuildStyle, agentPrompts[agentKey]]
    .filter(Boolean)
    .join('\n\n---\n\n')
}

function extractRawFromPack(rawInputSummary) {
  const marker = '原始描述：'
  const idx = rawInputSummary.indexOf(marker)
  if (idx >= 0) return rawInputSummary.slice(idx + marker.length).trim()
  return rawInputSummary.trim()
}

async function fetchRichestModuleInput(pool) {
  const family = process.env.BENCH_FAMILY
  const entryType = process.env.BENCH_ENTRY || 'family'
  const entryName = ENTRY_NAME_MAP[entryType] || entryType

  if (process.env.BENCH_RAW_FILE) {
    return {
      familyId: family || 'local-file',
      entryType,
      rawText: fs.readFileSync(process.env.BENCH_RAW_FILE, 'utf8').trim(),
      source: 'file',
    }
  }

  if (family) {
    const r = await pool.query(
      `SELECT family_id, data FROM memory_layer_items
       WHERE layer_name = $1 AND family_id = $2 AND data->>'entryName' = $3
       ORDER BY length(data::text) DESC LIMIT 1`,
      ['entry_evidence_packs', family, entryName],
    )
    if (r.rows[0]) {
      const summary = r.rows[0].data.rawInputSummary || ''
      return {
        familyId: r.rows[0].family_id,
        entryType,
        rawText: extractRawFromPack(summary).slice(0, 5000),
        source: `entry_evidence_packs:${entryName}`,
        rawInputSummaryLen: summary.length,
      }
    }
  }

  const r = await pool.query(
    `SELECT family_id, data FROM memory_layer_items
     WHERE layer_name = $1
     ORDER BY length(data::text) DESC LIMIT 1`,
    ['entry_evidence_packs'],
  )
  const row = r.rows[0]
  const summary = row.data.rawInputSummary || ''
  const en = row.data.entryName
  const reverse = Object.entries(ENTRY_NAME_MAP).find(([, v]) => v === en)?.[0] || 'family'
  return {
    familyId: row.family_id,
    entryType: reverse,
    rawText: extractRawFromPack(summary).slice(0, 5000),
    source: `entry_evidence_packs:${en}`,
    rawInputSummaryLen: summary.length,
  }
}

function isS3Enabled() {
  const v = (process.env.ONBOARDING_SUMMARY_S3 || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on'
}

async function callSummary({ agentPrompts, entryType, rawText, disableThinking }) {
  const apiKey = process.env.FAST_AI_API_KEY
  const model = process.env.FAST_AI_MODEL
  const base = (process.env.FAST_AI_BASE_URL || '').replace(/\/$/, '')
  const temp = Number(process.env.FAST_AI_TEMPERATURE || 0.7)
  if (!apiKey || !model || !base) throw new Error('FAST_AI not configured')

  const agentKey = SUMMARY_AGENT[entryType] || 'entryStageSummary'
  const system = buildEntryAnalyzeSystem(agentPrompts, agentKey)
  const topic = TITLE_MAP[entryType] || entryType
  const s3 = isS3Enabled()
  const s3Hint = s3
    ? `额外要求（动态最小充分）：
- 先写 familyMap：一句宏观家庭地图（谁在什么场景怎么互动，≤40 字）。
- sections：1–4 段，只写本材料能支撑的部分，勿凑固定模板；每段 title≤12 字、body 中等长度。
- sufficient：材料是否足以形成有效模块理解（乱码/极短/无法还原现场 → false）。
- 信息不足时：mainJudgment 明确说明不足，facts 可为空数组，sufficient=false；禁止编造具体场景。
- 禁止理论卡名、诊断标签、「机制」二字。`
    : ''
  const payload = {
    task: `家长在「${topic}」入口完成了描述（含可能的追问补充）。请写阶段总结。${s3Hint}只输出 JSON。`,
    entryType,
    topic,
    rawText: rawText.slice(0, 5000),
    summaryMode: s3 ? 'dynamic_minimum_sufficient' : 'legacy_four_field',
  }
  const user = `只输出 JSON，不输出 Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`

  const t0 = Date.now()
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: temp,
      max_tokens: s3 ? 1800 : 1400,
      response_format: { type: 'json_object' },
      ...(disableThinking ? { thinking: { type: 'disabled' } } : {}),
    }),
  })
  const responseMs = Date.now() - t0
  if (!response.ok) {
    const msg = await response.text().catch(() => '')
    throw new Error(`LLM ${response.status}: ${msg.slice(0, 300)}`)
  }
  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { parseError: true, raw: text.slice(0, 500) }
  }
  return { responseMs, parsed, usage: data.usage, systemChars: system.length, disableThinking }
}

function scoreQuality(parsed) {
  if (!parsed || parsed.parseError) return { score: 0, notes: ['JSON 解析失败'] }
  const notes = []
  let score = 0
  const mj = (parsed.mainJudgment || '').trim()
  if (mj.length >= 80) score += 2
  else if (mj.length >= 40) score += 1
  else notes.push(`mainJudgment 偏短(${mj.length})`)
  const facts = Array.isArray(parsed.facts) ? parsed.facts.filter(Boolean) : []
  if (facts.length >= 2) score += 2
  else notes.push(`facts 不足(${facts.length})`)
  const hyps = Array.isArray(parsed.pendingHypotheses) ? parsed.pendingHypotheses.filter(Boolean) : []
  if (hyps.length >= 2) score += 1
  else notes.push(`假设不足(${hyps.length})`)
  const hasQuote = facts.some((f) => /[「"'"]/.test(f) || f.length > 30)
  if (hasQuote) score += 1
  else notes.push('facts 缺原话/细节')
  return { score, notes, mjLen: mj.length, factCount: facts.length, hypCount: hyps.length }
}

const MODULE_SAMPLES = [
  { entryType: 'daily', family: 'fam_1784191475877_ov3wxy' },
  { entryType: 'homework', family: 'fam_1784127686585_ol1xiw' },
  { entryType: 'communication', family: 'fam_1783098127019_tmhyhv' },
  { entryType: 'family', family: 'fam_1783962382684_x89hej' },
]

async function runOneModule(agentPrompts, pool, entryType, familyId) {
  process.env.BENCH_FAMILY = familyId
  process.env.BENCH_ENTRY = entryType
  const sample = pool
    ? await fetchRichestModuleInput(pool)
    : await fetchRichestModuleInput(null)

  const thinkingOn = await callSummary({ agentPrompts, entryType: sample.entryType, rawText: sample.rawText, disableThinking: false })
  const thinkingOff = await callSummary({ agentPrompts, entryType: sample.entryType, rawText: sample.rawText, disableThinking: true })
  const onScore = scoreQuality(thinkingOn.parsed)
  const offScore = scoreQuality(thinkingOff.parsed)

  return {
    entryType: sample.entryType,
    familyId: sample.familyId,
    rawChars: sample.rawText.length,
    thinkingOnMs: thinkingOn.responseMs,
    thinkingOffMs: thinkingOff.responseMs,
    onParseOk: !thinkingOn.parsed?.parseError,
    offParseOk: !thinkingOff.parsed?.parseError,
    onMjLen: onScore.mjLen,
    offMjLen: offScore.mjLen,
    qualityScoreOn: onScore.score,
    qualityScoreOff: offScore.score,
    onMjPreview: (thinkingOn.parsed.mainJudgment || '').slice(0, 120),
    offMjPreview: (thinkingOff.parsed.mainJudgment || '').slice(0, 120),
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL
  const runAll = process.argv.includes('--all-modules')
  if (!dbUrl && !process.env.BENCH_RAW_FILE) {
    console.error('DATABASE_URL or BENCH_RAW_FILE required')
    process.exit(1)
  }

  const agentPrompts = await loadPromptRegistry()
  let pool
  if (dbUrl) pool = new pg.Pool({ connectionString: dbUrl })

  console.log('=== 配置（对齐生产 runEntrySummary）===')
  console.log('thinking OFF = 生产默认（disableThinking: frontAiThinkingDisabled）')
  console.log('maxTokens: S3=1800 / legacy=1400 · mainJudgment 目标 80–200 字（原规格）')

  if (runAll) {
    const results = []
    for (const mod of MODULE_SAMPLES) {
      console.log(`\n========== ${mod.entryType} ==========`)
      const row = await runOneModule(agentPrompts, pool, mod.entryType, mod.family)
      results.push(row)
      console.log(JSON.stringify(row, null, 2))
    }
    console.log('\n=== 四模块汇总 ===')
    console.log(JSON.stringify({
      model: process.env.FAST_AI_MODEL,
      modules: results,
      avgThinkingOnMs: Math.round(results.reduce((s, r) => s + r.thinkingOnMs, 0) / results.length),
      avgThinkingOffMs: Math.round(results.reduce((s, r) => s + r.thinkingOffMs, 0) / results.length),
      onParseOk: results.filter((r) => r.onParseOk).length,
      offParseOk: results.filter((r) => r.offParseOk).length,
      avgOffMjLen: Math.round(results.reduce((s, r) => s + r.offMjLen, 0) / results.length),
      avgOnMjLen: Math.round(results.reduce((s, r) => s + r.onMjLen, 0) / results.length),
    }, null, 2))
    if (pool) await pool.end()
    return
  }

  let sample
  if (dbUrl) {
    sample = await fetchRichestModuleInput(pool)
  } else {
    sample = await fetchRichestModuleInput(null)
  }

  console.log('=== 样本（生产库）===')
  console.log(JSON.stringify({
    familyId: sample.familyId,
    entryType: sample.entryType,
    source: sample.source,
    rawTextChars: sample.rawText.length,
    rawInputSummaryLen: sample.rawInputSummaryLen,
  }, null, 2))
  console.log('rawTextPreview:', sample.rawText.slice(0, 150).replace(/\n/g, ' '), '…')

  console.log('\n=== runEntrySummary（生产已关 thinking）===')

  console.log('\n=== Run A: thinking ON ===')
  const thinkingOn = await callSummary({
    agentPrompts,
    entryType: sample.entryType,
    rawText: sample.rawText,
    disableThinking: false,
  })
  const onScore = scoreQuality(thinkingOn.parsed)

  console.log('\n=== Run B: thinking OFF ===')
  const thinkingOff = await callSummary({
    agentPrompts,
    entryType: sample.entryType,
    rawText: sample.rawText,
    disableThinking: true,
  })
  const offScore = scoreQuality(thinkingOff.parsed)

  console.log('\n--- thinking ON ---')
  console.log('responseMs', thinkingOn.responseMs, 'quality', onScore)
  console.log('mainJudgment:', (thinkingOn.parsed.mainJudgment || '').slice(0, 300))
  console.log('facts:', (thinkingOn.parsed.facts || []).slice(0, 2))

  console.log('\n--- thinking OFF ---')
  console.log('responseMs', thinkingOff.responseMs, 'quality', offScore)
  console.log('mainJudgment:', (thinkingOff.parsed.mainJudgment || '').slice(0, 300))
  console.log('facts:', (thinkingOff.parsed.facts || []).slice(0, 2))

  console.log('\n=== 结论 ===')
  console.log(JSON.stringify({
    model: process.env.FAST_AI_MODEL,
    sample: { familyId: sample.familyId, entryType: sample.entryType, rawChars: sample.rawText.length },
    thinkingOnMs: thinkingOn.responseMs,
    thinkingOffMs: thinkingOff.responseMs,
    speedRatioOnOverOff: Number((thinkingOn.responseMs / Math.max(thinkingOff.responseMs, 1)).toFixed(2)),
    qualityScoreOn: onScore.score,
    qualityScoreOff: offScore.score,
    recommendation:
      offScore.score >= onScore.score - 1 && thinkingOff.responseMs < thinkingOn.responseMs * 0.7
        ? '可考虑给 runEntrySummary 也加 disableThinking: frontAiThinkingDisabled()'
        : 'thinking 对质量有明显增益，保持开启或抽样再测',
  }, null, 2))

  if (pool) await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

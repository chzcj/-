#!/usr/bin/env node
/**
 * 从 turn_events 还原 snapshot，用当前 SP + LLM 重跑 prose。
 *
 * 用法:
 *   export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
 *   node --import tsx scripts/replay-daily-prose.mjs [--limit=5] [--family=f_demo] [--dry-run]
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { agentPrompts } from '../src/lib/server/agent-prompts.ts'
import {
  buildDailyProsePayload,
  buildDailyProseTask,
  clampProse,
  resolveProseRouting,
} from '../src/lib/server/daily/prose-context.ts'
import { pickFrontendReadPack } from '../src/lib/server/daily/frontend-read-pack.ts'
import { pickDeepModelDigestPack } from '../src/lib/server/memory/deep-modeling/pick-deep-model-digest.ts'
import { combinedDailyProseSystem } from './lib/combined-daily-prose-system.mjs'

const args = process.argv.slice(2)
const getArg = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : def
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const families = (getArg('family', '') || process.env.REPLAY_FAMILIES || 'f_demo,fam_1783439265597_luqfco')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const limitPerFamily = Number(getArg('limit', process.env.REPLAY_LIMIT || '5'))
const dryRun = args.includes('--dry-run')

const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const outPath =
  getArg('out', process.env.REPLAY_OUT || '') ||
  path.join('.trae/documents', `prose-replay-${date}.md`)

const EMPTY_RETRIEVED = {
  relevantChildStructureModel: [],
  relevantEntryEvidencePacks: [],
  relevantPastEvents: [],
  relevantPendingHypotheses: [],
  relevantFamilyInteractionPatterns: [],
  matchedMechanisms: [],
  recentDiagnosis: [],
  parentNarrativePattern: [],
  childQuotes: [],
  entryFacts: [],
}

const DEFAULT_ROUTING = {
  frontResponseType: 'model_based_explanation',
  needFollowup: false,
  followupQuestion: '',
  needMemoryWrite: false,
  needDeepDiagnosis: false,
  needResynthesis: false,
}

const DEFAULT_MEMORY = {
  writeRawFact: [],
  writeGrowthRecord: [],
  updatePendingHypothesis: [],
  updateStableProfile: [],
  updateFamilyInteractionPattern: [],
  updateWeeklyReportMaterial: [],
  doNotWrite: [],
}

function turnEventToOutput(event) {
  return {
    agent: 'daily_dialogue_orchestration_agent',
    contextMaturityLevel: event.maturityLevel || 'L2',
    inputType: event.inputType || 'scene_report',
    retrievedContext: event.retrievedContextSnapshot || EMPTY_RETRIEVED,
    relationshipToExistingModel: event.relationship || {
      type: 'insufficient',
      explanation: 'replay',
      confidence: 'low',
    },
    routingDecision: event.routingDecisionSnapshot || DEFAULT_ROUTING,
    memoryAction: event.memoryActionSnapshot || DEFAULT_MEMORY,
    frontResponseDraft: event.assistantReply || '',
  }
}

function combinedProseSystem() {
  return combinedDailyProseSystem(agentPrompts)
}

function laneConfig() {
  const apiKey =
    process.env.PARENT_AI_API_KEY || process.env.ARK_API_KEY || process.env.FAST_AI_API_KEY || ''
  const model = process.env.PARENT_AI_MODEL || process.env.FAST_AI_MODEL || 'deepseek-v4-flash'
  const base = (
    process.env.PARENT_AI_BASE_URL ||
    process.env.ARK_BASE_URL ||
    process.env.FAST_AI_BASE_URL ||
    'https://api.deepseek.com/v1'
  ).replace(/\/$/, '')
  const temp = Number(process.env.PARENT_AI_TEMPERATURE || process.env.FAST_AI_TEMPERATURE || 0.25)
  return { apiKey, model, base, temp }
}

async function callProseStream(system, task, payload) {
  const { apiKey, model, base, temp } = laneConfig()
  if (!apiKey) throw new Error('PARENT_AI_API_KEY or FAST_AI_API_KEY required')

  const user = `${task}\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
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
        { role: 'user', content: `只输出要展示给用户的文本，不输出 Markdown 或解释。\n\n${user}` },
      ],
      stream: false,
      temperature: temp,
      max_tokens: Number(process.env.FAST_AI_STREAM_MAX_TOKENS || 1024),
      thinking: { type: 'disabled' },
    }),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(`LLM_FAILED:${response.status}:${message.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content?.trim() || ''
  if (!text) throw new Error('LLM_EMPTY_OUTPUT')
  return text
}

function scoreProseHeuristic({ userText, prose, packFactCount }) {
  const p = prose.trim()
  const u = userText.trim()

  let archiveFit = 1
  if (packFactCount === 0) archiveFit = p.length > 20 ? 1 : 0
  else {
    const uTokens = [...new Set(u.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/).filter((t) => t.length >= 2))]
    const hits = uTokens.filter((t) => p.includes(t)).length
    if (hits >= 2) archiveFit = 3
    else if (hits >= 1) archiveFit = 2
    else if (/知道了|作业|手机|考试|学校|写/.test(p)) archiveFit = 2
    else archiveFit = 1
  }

  let directAnswer = 2
  if (/这里想区分|后面处理不一样|试完可能看到|最值得观察的对比点/.test(p)) directAnswer = 0

  let continuity = 1
  if (/之前|上次|一贯|还是|又|这次/.test(p)) continuity = 2
  if (/之前|上次/.test(p) && /这次|更|新|不一样/.test(p)) continuity = 3

  let antiPattern = 3
  if (/这里想区分|后面处理不一样/.test(p)) antiPattern = 0
  else if (/随着.*不断发展|综上所述|希望对您有帮助|赋能|闭环/.test(p)) antiPattern = 1
  else if (/这你太熟了/.test(p)) antiPattern = 2

  let singleFocus = 2
  const sentenceCount = p.split(/[。！？!?]/).filter((s) => s.trim().length > 4).length
  if (sentenceCount <= 3 && p.length <= 220) singleFocus = 3
  else if (sentenceCount >= 6 || /首先|其次|另外|第一|第二/.test(p)) singleFocus = 0
  else if (sentenceCount >= 4) singleFocus = 1

  let plainLanguage = 2
  if (/启动困难|评价敏感|内驱力|自主权|机制链|模式对上了|卡的是|难的是/.test(p)) plainLanguage = 0
  else if (/属于.*那一类|综上所述/.test(p)) plainLanguage = 1
  else if (p.length > 0 && p.length <= 200) plainLanguage = 3

  return { archiveFit, directAnswer, continuity, antiPattern, singleFocus, plainLanguage }
}

function rubricTotal(scores) {
  return (
    scores.archiveFit +
    scores.directAnswer +
    scores.continuity +
    scores.antiPattern +
    scores.singleFocus +
    scores.plainLanguage
  )
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 })

async function loadDigestForFamily(familyId, childId) {
  const { rows } = await pool.query(
    `SELECT data FROM memory_layer_items
     WHERE layer_name='deep_model_digest' AND family_id=$1 AND child_id=$2 AND item_id='latest'`,
    [familyId, childId]
  )
  return rows[0]?.data ?? null
}

async function replayOne(event, familyId, childId) {
  const output = turnEventToOutput(event)
  const userText = event.userMessage?.trim() || ''
  const before = event.assistantReply?.trim() || ''
  const { mode, reason } = resolveProseRouting(output, userText)

  if (output.relationshipToExistingModel.type === 'safety') {
    return { before, after: output.frontResponseDraft.trim(), mode: `${mode} (${reason})`, maxChars: 200 }
  }

  const digestPack = pickDeepModelDigestPack(await loadDigestForFamily(familyId, childId))
  const prosePayload = buildDailyProsePayload(output, userText, { deepModelDigest: digestPack })
  const task = buildDailyProseTask(output, userText)
  const raw = await callProseStream(combinedProseSystem(), task, prosePayload)
  const after = clampProse(raw, mode, { familyId, traceId: event.traceId })
  const truncated = after.endsWith('…') || (raw.trim().length > prosePayload.maxChars)
  return { before, after, mode: `${mode} (${reason})`, maxChars: prosePayload.maxChars, truncated }
}

async function fetchTraces(familyId) {
  const { rows } = await pool.query(
    `
    SELECT item_id AS trace_id, family_id, child_id, data
    FROM memory_layer_items
    WHERE layer_name = 'turn_events'
      AND family_id = $1
      AND data->>'mode' = 'daily_dialogue'
      AND length(coalesce(data->>'assistantReply', '')) > 30
    ORDER BY (data->>'createdAt') DESC
    LIMIT $2
  `,
    [familyId, limitPerFamily]
  )
  return rows
}

const lines = [
  `# Prose Replay 报告 · ${new Date().toISOString().slice(0, 19)}`,
  '',
  '> Before = 生产 assistantReply · After = 当前 workspace SP + LLM 重跑（真实 API）',
  '',
  `Families: ${families.join(', ')} · limit=${limitPerFamily}/family`,
  '',
  'Rubric: [.trae/documents/prose-replay-rubric.md](./prose-replay-rubric.md)',
  '',
]

let totalBefore = 0
let totalAfter = 0
let count = 0
let truncateCount = 0

for (const familyId of families) {
  lines.push(`## family: ${familyId}`, '')
  const rows = await fetchTraces(familyId)
  if (!rows.length) {
    lines.push('_无 turn_events_', '')
    continue
  }

  for (const row of rows) {
    const event = row.data
    event.traceId = row.trace_id
    const userText = event.userMessage || ''
    const pack = pickFrontendReadPack(event.retrievedContextSnapshot || {})
    const packFactCount =
      pack.entryFacts.length + pack.childQuotes.length + pack.dossierSlice.length

    lines.push(`### ${row.trace_id}`, '')
    lines.push(`**家长输入：** ${userText.slice(0, 120)}${userText.length > 120 ? '…' : ''}`, '')
    lines.push(`**pack：** entryFacts=${pack.entryFacts.length} dossierSlice=${pack.dossierSlice.length}`, '')
    lines.push('')

    if (dryRun) {
      lines.push('| | 文本 |', '|---|---|')
      lines.push(`| **Before** | ${(event.assistantReply || '').replace(/\|/g, '\\|')} |`)
      lines.push('| **After** | _(dry-run)_ |')
      lines.push('')
      continue
    }

    try {
      const { before, after, mode, maxChars, truncated } = await replayOne(
        event,
        row.family_id,
        row.child_id
      )
      if (truncated) truncateCount++
      const beforeScores = scoreProseHeuristic({ userText, prose: before, packFactCount })
      const afterScores = scoreProseHeuristic({ userText, prose: after, packFactCount })
      const beforeSum = rubricTotal(beforeScores)
      const afterSum = rubricTotal(afterScores)
      totalBefore += beforeSum
      totalAfter += afterSum
      count++

      lines.push(`**mode:** ${mode} · **maxChars:** ${maxChars}${truncated ? ' · **截断**' : ''}`, '')
      lines.push('| | 文本 | rubric |', '|---|---|---|')
      lines.push(
        `| **Before（线上）** | ${before.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${beforeSum}/18 |`
      )
      lines.push(
        `| **After（重跑）** | ${after.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${afterSum}/18 |`
      )
      lines.push(`| **scores** | before ${JSON.stringify(beforeScores)} | after ${JSON.stringify(afterScores)} |`)
      lines.push('')
    } catch (err) {
      lines.push(`**ERROR:** ${err instanceof Error ? err.message : String(err)}`, '')
    }
  }
}

if (count > 0) {
  lines.push('## 汇总', '')
  lines.push(`- 样本数：${count}`)
  lines.push(`- Before 均分：${(totalBefore / count).toFixed(2)}/18`)
  lines.push(`- After 均分：${(totalAfter / count).toFixed(2)}/18`)
  lines.push(`- After 截断率：${truncateCount}/${count}`)
  lines.push('')
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, lines.join('\n'))
console.log(`[replay-daily-prose] wrote ${outPath}${dryRun ? ' (dry-run)' : ''} samples=${count}`)

await pool.end()
process.exit(0)

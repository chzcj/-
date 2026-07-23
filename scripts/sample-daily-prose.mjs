#!/usr/bin/env node
/**
 * 用当前 SP + 真实 turn snapshot 生成若干条 prose 样例（仅 After，供人工阅读）。
 *
 * 用法:
 *   export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
 *   node --import tsx scripts/sample-daily-prose.mjs
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
import { loadDeepModelDigest } from '../src/lib/server/memory/deep-modeling/digest-store.ts'
import { pickDeepModelDigestPack } from '../src/lib/server/memory/deep-modeling/pick-deep-model-digest.ts'
import { combinedDailyProseSystem } from './lib/combined-daily-prose-system.mjs'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const SCENARIOS = [
  {
    label: 'analysis · 作业拖延+知道了',
    familyId: 'f_demo',
    userText: '孩子今天写作业前拖了很久，我提醒后他说知道了但还是不动。',
  },
  {
    label: 'analysis · 吼孩子+找借口',
    familyId: 'f_demo',
    userText: '今天又是催了三遍才开始写，一坐下没五分钟就说要喝水上厕所，我真的忍不住吼了他。',
  },
  {
    label: 'analysis · 要方法',
    familyId: 'f_demo',
    userText: '那我今晚到底该怎么做？总不能看着他拖到十一点吧。',
    inputType: 'ask_advice',
    relType: 'consistent',
    responseType: 'advice_from_dossier',
  },
  {
    label: 'follow_up · 信息不够',
    familyId: 'f_demo',
    userText: '他最近情绪好像不对，但我也说不上来。',
    relType: 'insufficient',
    needFollowup: true,
    responseType: 'one_key_followup',
  },
  {
    label: 'analysis · 真实家长 family',
    familyId: 'fam_1783439265597_luqfco',
    userText: '最近跟他老吵架，因为他妈妈老管他，我夹在中间很难受。',
  },
]

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
  return data.choices?.[0]?.message?.content?.trim() || ''
}

function buildOutputFromTurn(event, overrides) {
  const relType = overrides.relType || event.relationship?.type || 'consistent'
  const route = event.routingDecisionSnapshot || {}
  return {
    agent: 'daily_dialogue_orchestration_agent',
    contextMaturityLevel: event.maturityLevel || 'L3',
    inputType: overrides.inputType || event.inputType || 'scene_report',
    retrievedContext: event.retrievedContextSnapshot || {},
    relationshipToExistingModel: {
      type: relType,
      explanation: 'sample',
      confidence: relType === 'insufficient' ? 'low' : 'medium',
    },
    routingDecision: {
      frontResponseType: overrides.responseType || route.frontResponseType || 'model_based_explanation',
      needFollowup: overrides.needFollowup ?? route.needFollowup ?? false,
      followupQuestion: route.followupQuestion || '',
      needMemoryWrite: false,
      needDeepDiagnosis: false,
      needResynthesis: false,
    },
    memoryAction: event.memoryActionSnapshot || {
      writeRawFact: [],
      writeGrowthRecord: [],
      updatePendingHypothesis: [],
      updateStableProfile: [],
      updateFamilyInteractionPattern: [],
      updateWeeklyReportMaterial: [],
      doNotWrite: [],
    },
    frontResponseDraft: '',
  }
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 })

async function loadTemplateTurn(familyId) {
  const { rows } = await pool.query(
    `
    SELECT data FROM memory_layer_items
    WHERE layer_name = 'turn_events' AND family_id = $1
      AND data->>'mode' = 'daily_dialogue'
      AND length(coalesce(data->>'assistantReply', '')) > 40
    ORDER BY (data->>'createdAt') DESC LIMIT 1
  `,
    [familyId]
  )
  return rows[0]?.data || null
}

const lines = [
  `# Prose 样例（新 SP · ${new Date().toISOString().slice(0, 19)}）`,
  '',
  '> 当前 workspace SP + 生产库真实 retrievalPack snapshot + 真实 LLM API',
  '',
]

for (const sc of SCENARIOS) {
  const template = await loadTemplateTurn(sc.familyId)
  if (!template) {
    lines.push(`## ${sc.label}`, '', `_无 ${sc.familyId} turn 模板_`, '')
    continue
  }

  const output = buildOutputFromTurn(template, sc)
  const { mode, reason } = resolveProseRouting(output, sc.userText)
  const digestPack = pickDeepModelDigestPack(
    await loadDeepModelDigest({ familyId: sc.familyId, childId: template.childId || 'c_demo' }).catch(
      () => null
    )
  )
  const payload = buildDailyProsePayload(output, sc.userText, { deepModelDigest: digestPack })
  const task = buildDailyProseTask(output, sc.userText)

  let prose = ''
  try {
    const raw = await callProseStream(combinedProseSystem(), task, payload)
    prose = clampProse(raw, mode)
  } catch (err) {
    prose = `[ERROR: ${err instanceof Error ? err.message : String(err)}]`
  }

  const pack = payload.retrievalPack || {}
  lines.push(`## ${sc.label}`, '')
  lines.push(`- **family:** ${sc.familyId}`)
  lines.push(`- **proseMode:** ${mode} (${reason}) · **maxChars:** ${payload.maxChars}`)
  lines.push(
    `- **pack 规模:** entryFacts=${pack.entryFacts?.length || 0} dossierSlice=${pack.dossierSlice?.length || 0} childQuotes=${pack.childQuotes?.length || 0}`
  )
  lines.push(`- **turnRelevantSnippets:** ${(payload.turnRelevantSnippets || []).slice(0, 2).join('；')}${(payload.turnRelevantSnippets?.length || 0) > 2 ? '…' : ''}`)
  lines.push('')
  lines.push('**家长：**')
  lines.push('')
  lines.push(`> ${sc.userText}`)
  lines.push('')
  lines.push('**育见 prose：**')
  lines.push('')
  lines.push(prose)
  lines.push('')
  lines.push('---')
  lines.push('')
}

const outPath = path.join('.trae/documents', `prose-samples-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.md`)
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, lines.join('\n'))
console.log(`[sample-daily-prose] wrote ${outPath}`)

await pool.end()

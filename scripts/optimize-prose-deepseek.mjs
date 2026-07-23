#!/usr/bin/env node
/**
 * 试验：DeepSeek 对 daily prose 做「加深一层」优化（不改 SP 文件）
 *
 *   export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
 *   node --import tsx scripts/optimize-prose-deepseek.mjs
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

const SCENARIOS = [
  {
    label: '1 · 知道了但不动',
    familyId: 'f_demo',
    userText: '孩子今天写作业前拖了很久，我提醒后他说知道了但还是不动。',
  },
  {
    label: '2 · 催三遍+吼了',
    familyId: 'f_demo',
    userText: '今天又是催了三遍才开始写，一坐下没五分钟就说要喝水上厕所，我真的忍不住吼了他。',
  },
  {
    label: '3 · 今晚怎么办',
    familyId: 'f_demo',
    userText: '那我今晚到底该怎么做？总不能看着他拖到十一点吧。',
    inputType: 'ask_advice',
    relType: 'consistent',
    responseType: 'advice_from_dossier',
  },
  {
    label: '4 · 情绪说不清',
    familyId: 'f_demo',
    userText: '他最近情绪好像不对，但我也说不上来。',
    relType: 'insufficient',
    needFollowup: true,
    responseType: 'one_key_followup',
  },
  {
    label: '5 · 夹在中间',
    familyId: 'fam_1783439265597_luqfco',
    userText: '最近跟他老吵架，因为他妈妈老管他，我夹在中间很难受。',
  },
]

const OPTIMIZE_SYSTEM = `你是育见前台 prose 的润色编辑（不是通用 AI 助手）。

输入 JSON：家长原话、本轮在担心什么、家庭材料、SP 初稿、maxChars。

只输出润色后的一段中文 prose（无标题、无 markdown、无解释）。

## 原则
- **每轮只讲一个重点**——不必大而全；字数紧时只留最帮家长的一刀。
- **说人话**：短句、家常；用动作和原话；禁止贴标签式概括。
- **可以讲透一点**（建议）：家长在问「怎么回事」时，用一两句讲清这户**一个**关键点（家长做了 A → 孩子听成 B → 于是 C）；只展开与本题最相关的一环。
- 先接住家长这轮在要什么，再答。

## 避免
复述现象当主体；「属于 XX 类」「他怕的是…」；启动/卡的是/越…越…等 AI 套话；理论名与后台术语。

## 语气
读过档案的班主任当面聊：清楚、从容、不训人。须在 maxChars 内写完。`

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
  const temp = Number(process.env.PARENT_AI_TEMPERATURE || 0.3)
  return { apiKey, model, base, temp }
}

async function llmJson(system, userPayload, maxTokens = 1024) {
  const { apiKey, model, base, temp } = laneConfig()
  if (!apiKey) throw new Error('API key missing')

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userPayload, null, 2) },
      ],
      stream: false,
      temperature: temp,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
    }),
  })
  if (!response.ok) throw new Error(`LLM ${response.status}: ${(await response.text()).slice(0, 200)}`)
  const data = await response.json()
  return (data.choices?.[0]?.message?.content || '').trim()
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

function guessParentWorry(userText) {
  if (/怎么办|该怎么做|总不能/.test(userText)) return '怕今晚又失控、想要一个能落地的办法'
  if (/忍不住|吼/.test(userText)) return '吼完内疚、想知道还能怎么收场'
  if (/说不上来|好像不对/.test(userText)) return '模糊不安、希望被认真对待而不是被敷衍'
  if (/夹在中间|难受/.test(userText)) return '不是要评理，是要有人看见自己的难处'
  if (/知道了|不动|拖/.test(userText)) return '怕孩子懒或不自觉、也怕自己提醒没用'
  return '需要被理解 + 想知道这孩子到底怎么回事'
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })

async function loadTemplateTurn(familyId) {
  const { rows } = await pool.query(
    `SELECT data FROM memory_layer_items
     WHERE layer_name='turn_events' AND family_id=$1
       AND data->>'mode'='daily_dialogue'
       AND length(coalesce(data->>'assistantReply',''))>40
     ORDER BY (data->>'createdAt') DESC LIMIT 1`,
    [familyId]
  )
  return rows[0]?.data
}

const lines = [
  `# Prose DeepSeek 优化试验 · ${new Date().toISOString().slice(0, 19)}`,
  '',
  '> 流程：当前 SP 生成初稿 → DeepSeek 润色（加深一层 + 凝练概括 + 去惯用词）',
  '',
]

for (const sc of SCENARIOS) {
  const template = await loadTemplateTurn(sc.familyId)
  if (!template) continue

  const output = buildOutputFromTurn(template, sc)
  const { mode, reason } = resolveProseRouting(output, sc.userText)
  const maxChars = mode === 'analysis' ? 200 : mode === 'follow_up' ? 100 : 80
  const digestPack = pickDeepModelDigestPack(
    await loadDeepModelDigest({ familyId: sc.familyId, childId: 'c_demo' }).catch(() => null)
  )
  const payload = buildDailyProsePayload(output, sc.userText, { deepModelDigest: digestPack })
  const task = buildDailyProseTask(output, sc.userText)

  let draft = ''
  let optimized = ''
  try {
    draft = clampProse(
      await llmJson(
        combinedProseSystem(),
        { task, instruction: '只输出 prose 正文', ...payload },
        1024
      ),
      mode
    )

    const packSummary = {
      entryFacts: (payload.retrievalPack?.entryFacts || []).slice(0, 8),
      childQuotes: (payload.retrievalPack?.childQuotes || []).slice(0, 4),
      dossierSlice: (payload.retrievalPack?.dossierSlice || []).slice(0, 4),
      turnRelevantSnippets: payload.turnRelevantSnippets || [],
    }

    optimized = clampProse(
      await llmJson(OPTIMIZE_SYSTEM, {
        userText: sc.userText,
        maxChars,
        parentLikelyWorry: guessParentWorry(sc.userText),
        familyMaterialSummary: packSummary,
        draftProse: draft,
      }),
      mode
    )
  } catch (e) {
    optimized = `[ERROR ${e.message}]`
  }

  lines.push(`## ${sc.label}`, '')
  lines.push(`**家长：** ${sc.userText}`, '')
  lines.push(`**mode:** ${mode} (${reason}) · **maxChars:** ${maxChars}`, '')
  lines.push('')
  lines.push('**SP 初稿：**', '', draft || '—', '')
  lines.push('**DeepSeek 优化：**', '', optimized, '')
  lines.push('---', '')
}

const out = path.join('.trae/documents', `prose-deepseek-optimize-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.md`)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}`)
await pool.end()

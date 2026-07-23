#!/usr/bin/env node
/**
 * 全量家庭记忆 + 「机制答疑」prose 试验
 *
 * 对照：当前 SP 初稿 vs DeepSeek 机制答疑（讲透心理/互动链，非现象标签）
 *
 *   export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
 *   node --import tsx scripts/prose-mechanism-qa-trial.mjs [--family=fam_xxx]
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
import { combinedDailyProseSystem } from './lib/combined-daily-prose-system.mjs'
import { pickDeepModelDigestPack } from '../src/lib/server/memory/deep-modeling/pick-deep-model-digest.ts'

const familyId =
  process.argv.find((a) => a.startsWith('--family='))?.split('=').slice(1).join('=') ||
  'fam_1783439265597_luqfco'

const SCENARIOS = [
  {
    label: '1 · 夹在中间（真实家庭）',
    userText: '最近跟他老吵架，因为他妈妈老管他，我夹在中间很难受。',
  },
  {
    label: '2 · 知道了但不动',
    userText: '孩子今天写作业前拖了很久，我提醒后他说知道了但还是不动。',
  },
  {
    label: '3 · 今晚怎么办',
    userText: '那我今晚到底该怎么做？总不能看着他拖到十一点吧。',
    inputType: 'ask_advice',
    relType: 'consistent',
    responseType: 'advice_from_dossier',
  },
]

/** 机制答疑润色：deep mechanism 的「讲透」感，家长可见通俗版；每轮只抓一个重点 */
const MECHANISM_QA_SYSTEM = `你是育见前台 prose 的润色编辑（不是通用 AI 助手）。

输入 JSON：家长原话、本轮在担心什么、全量家庭记忆、SP 初稿、maxChars。

只输出润色后的一段中文 prose（无标题、无 markdown、无解释）。

## 原则
- **每轮只讲一个重点**——不必大而全，不必每段都「承接+分析+建议」；字数紧时只留最帮家长的那一刀。
- **说人话**：短句、家常、念一遍就懂；用动作和原话，少用抽象词和报告腔。
- **可以讲透一点**（建议，非必须）：当家长在问「怎么回事」、材料够时，用一两句把这户**一个**关键点讲清楚——常见说法是「家长做了 A → 孩子听成 B → 于是 C」；**只展开与本题最相关的一环**，其余不写。
- 先接住家长这轮在要什么（被听见 / 搞懂孩子 / 要办法 / 补现场），再答；不必为了显得专业而堆判断。

## 避免
- 复述家长刚说的现象当正文主体。
- 贴标签（「属于 XX 类」「他怕的是…他躲的是…」）代替讲清楚。
- 中间变量（启动困难、评价敏感、内驱力）——宜落到这户的具体动作/原话。
- 理论名、后台术语；AI 惯用套话（收窄、卡的是、越…越…、扛着、炸、启动 等）。

## 语气
读过档案的班主任当面聊：清楚、从容、不训人。不是心理测评，不是 ChatGPT 总结。`

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
  const temp = Number(process.env.PARENT_AI_TEMPERATURE || 0.35)
  return { apiKey, model, base, temp }
}

async function llmText(system, userPayload, maxTokens = 1200) {
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

function combinedProseSystem() {
  return combinedDailyProseSystem(agentPrompts)
}

function guessParentWorry(userText) {
  if (/怎么办|该怎么做|总不能/.test(userText)) return '怕今晚又失控，要一个能落地的办法'
  if (/忍不住|吼/.test(userText)) return '吼完内疚，想知道怎么回事、还能怎么收场'
  if (/说不上来|好像不对/.test(userText)) return '模糊不安，希望被认真对待'
  if (/夹在中间|难受/.test(userText)) return '不是要评理，是要有人看见自己的难处，并理解孩子为什么炸'
  if (/知道了|不动|拖/.test(userText)) return '怕孩子懒或不自觉，也怕自己提醒没用'
  return '需要被理解，并想知道孩子心里到底怎么回事'
}

function summarizeEntryPack(pack) {
  if (!pack || typeof pack !== 'object') return null
  const p = pack
  return {
    entryName: p.entryName,
    rawInputSummary: p.rawInputSummary,
    keyFacts: (p.keyFacts || p.facts || []).slice?.(0, 12) || [],
    childBehaviors: (p.childBehaviors || []).slice?.(0, 8) || [],
    triggerPoints: (p.triggerPoints || []).slice?.(0, 6) || [],
    parentActions: (p.parentActions || []).slice?.(0, 6) || [],
    childQuotes: (p.childQuotes || []).slice?.(0, 6) || [],
  }
}

function summarizeMechanism(m) {
  if (!m || typeof m !== 'object') return null
  return {
    name: m.mechanismName,
    description: m.description,
    chain: m.familyInteractionChain,
    protective: m.possibleProtectiveFunction,
    behaviors: (m.explainedBehaviors || []).slice(0, 4),
    evidence: (m.supportingEvidence || []).slice(0, 4),
    strength: m.overallStrength,
  }
}

function summarizeDossier(d) {
  if (!d || typeof d !== 'object') return null
  return {
    version: d.version,
    integratedSynthesis: d.integratedSynthesis,
    workingHypothesis: d.workingHypothesis?.text,
    sceneReadings: (d.sceneReadings || []).slice(0, 6).map((s) => ({
      scene: s.scene,
      reading: s.reading,
    })),
    parentPerspectives: (d.parentPerspectives || []).slice(0, 4),
    interventionTargets: (d.interventionTargets || []).slice(0, 3).map((t) => ({
      action: t.action,
      prediction: t.prediction,
      obstacle: t.obstacle,
    })),
    familyStruct: (d.familyStruct || []).slice(0, 5).map((f) => f.label),
  }
}

async function loadFullFamilyMemory(pool, fid) {
  const { rows: meta } = await pool.query(
    `SELECT DISTINCT child_id FROM memory_layer_items WHERE family_id = $1 LIMIT 1`,
    [fid]
  )
  const childId = meta[0]?.child_id || 'c_demo'

  const { rows } = await pool.query(
    `SELECT layer_name, item_id, data, updated_at
     FROM memory_layer_items
     WHERE family_id = $1 AND child_id = $2
     ORDER BY layer_name, updated_at DESC`,
    [fid, childId]
  )

  const byLayer = {}
  for (const r of rows) {
    if (!byLayer[r.layer_name]) byLayer[r.layer_name] = []
    byLayer[r.layer_name].push(r.data)
  }

  const entryPacks = (byLayer.entry_evidence_packs || []).map(summarizeEntryPack).filter(Boolean)
  const network = byLayer.evidence_networks?.[0]
  const mechanisms = (network?.candidateMechanismMatrix || network?.mechanisms || [])
    .map(summarizeMechanism)
    .filter(Boolean)
    .slice(0, 12)

  const digestRaw = byLayer.deep_model_digest?.[0]
  const digestPack = pickDeepModelDigestPack(digestRaw, { forceThick: true })
  const dossier = summarizeDossier(digestRaw?.dossier)

  const cycles = (byLayer.family_interaction_cycles || []).slice(0, 6).map((c) => ({
    name: c.cycleName || c.name,
    description: c.description || c.summary,
    chain: c.interactionChain || c.chain,
  }))

  const hypotheses = (byLayer.pending_hypotheses || []).slice(0, 8).map((h) => ({
    hypothesis: h.hypothesis,
    weight: h.weight,
    scenes: h.applicableScenes,
  }))

  const parentPattern = byLayer.parent_narrative_patterns?.[0]
  const dailyUpdates = (byLayer.daily_interaction_updates || []).slice(0, 10).map((u) => ({
    date: u.date || u.createdAt,
    summary: u.summary || u.text,
  }))

  const recentTurns = (byLayer.turn_events || [])
    .filter((t) => t.mode === 'daily_dialogue' && (t.userText || t.assistantReply))
    .slice(0, 8)
    .map((t) => ({
      userText: (t.userText || '').slice(0, 120),
      assistantReply: (t.assistantReply || '').slice(0, 120),
      createdAt: t.createdAt,
    }))

  const childInfo = byLayer.child_basic_info?.[0]
  const profile = byLayer.built_profile_snapshots?.[0]

  const layerCounts = Object.fromEntries(
    Object.entries(byLayer).map(([k, v]) => [k, v.length])
  )

  return {
    familyId: fid,
    childId,
    layerCounts,
    childInfo: childInfo
      ? { nickname: childInfo.nickname, grade: childInfo.grade, age: childInfo.age }
      : null,
    profileHeadline: profile?.headline || profile?.summary || '',
    entryPacks,
    mechanisms,
    deepModelDigest: digestPack,
    dossier,
    interactionCycles: cycles,
    pendingHypotheses: hypotheses,
    parentNarrativePattern: parentPattern
      ? {
          observations: parentPattern.observations,
          interactionImplications: parentPattern.interactionImplications,
        }
      : null,
    dailyUpdates,
    recentTurns,
  }
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
      explanation: 'trial',
      confidence: 'medium',
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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })

const memory = await loadFullFamilyMemory(pool, familyId)

const { rows: templateRows } = await pool.query(
  `SELECT data FROM memory_layer_items
   WHERE layer_name='turn_events' AND family_id=$1
     AND data->>'mode'='daily_dialogue'
     AND length(coalesce(data->>'assistantReply',''))>40
   ORDER BY (data->>'createdAt') DESC LIMIT 1`,
  [familyId]
)
const template = templateRows[0]?.data
if (!template) {
  console.error('no template turn for', familyId)
  process.exit(1)
}

const lines = [
  `# Prose 机制答疑试验 · ${new Date().toISOString().slice(0, 19)}`,
  '',
  `> 家庭：**${familyId}** / ${memory.childId} · 全量记忆层 → SP 初稿 → DeepSeek **机制答疑**（讲透互动链，非标签概括）`,
  '',
  '## 记忆规模',
  '',
  '```json',
  JSON.stringify(memory.layerCounts, null, 2),
  '```',
  '',
  '### 可用理解材料（摘要）',
  '',
  `- **entryPacks:** ${memory.entryPacks.length} 个入口`,
  `- **mechanisms:** ${memory.mechanisms.length} 条`,
  `- **dossier:** v${memory.dossier?.version ?? '—'} · synthesis ${(memory.dossier?.integratedSynthesis || '').slice(0, 80)}…`,
  `- **digest loops:** ${memory.deepModelDigest.interactionLoops.length} · **facts:** ${memory.deepModelDigest.anchoredFacts.length}`,
  `- **recent turns:** ${memory.recentTurns.length}`,
  '',
]

for (const sc of SCENARIOS) {
  const output = buildOutputFromTurn(template, sc)
  const { mode, reason } = resolveProseRouting(output, sc.userText)
  const maxChars = mode === 'analysis' ? 200 : mode === 'follow_up' ? 100 : 80

  const digestRaw = await pool.query(
    `SELECT data FROM memory_layer_items
     WHERE layer_name='deep_model_digest' AND family_id=$1 AND child_id=$2 AND item_id='latest'`,
    [familyId, memory.childId]
  )
  const digestFull = digestRaw.rows[0]?.data
  const digestPack = pickDeepModelDigestPack(digestFull, { forceThick: true })

  const payload = buildDailyProsePayload(output, sc.userText, { deepModelDigest: digestPack })
  const task = buildDailyProseTask(output, sc.userText)

  let draft = ''
  let mechanismQa = ''
  try {
    draft = clampProse(
      await llmText(combinedProseSystem(), { task, instruction: '只输出 prose 正文', ...payload }),
      mode
    )

    mechanismQa = clampProse(
      await llmText(MECHANISM_QA_SYSTEM, {
        userText: sc.userText,
        maxChars,
        parentLikelyWorry: guessParentWorry(sc.userText),
        fullFamilyMemory: memory,
        draftProse: draft,
        instruction:
          '用全量记忆中的机制链/循环/dossier 讲透这户孩子的心理与互动，直接答家长这轮问题。不要现象标签。',
      }),
      mode
    )
  } catch (e) {
    mechanismQa = `[ERROR ${e.message}]`
  }

  lines.push(`## ${sc.label}`, '')
  lines.push(`**家长：** ${sc.userText}`, '')
  lines.push(`**mode:** ${mode} (${reason}) · **maxChars:** ${maxChars}`, '')
  lines.push('')
  lines.push('**SP 初稿（薄 pack 路由）：**', '', draft || '—', '')
  lines.push('**机制答疑版（全量记忆 + 讲透链）：**', '', mechanismQa || '—', '')
  lines.push('---', '')
}

const out = path.join(
  '.trae/documents',
  `prose-mechanism-qa-${familyId.replace(/[^a-z0-9_]/gi, '_')}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.md`
)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, lines.join('\n'))
console.log(`wrote ${out}`)
await pool.end()

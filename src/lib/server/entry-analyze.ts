import { callFastJson } from '@/lib/server/ark-agents'
import { sanitizeForParent } from '@/lib/server/daily/profile-sanitize'
import { resolveEntryFollowUpAgent, resolveEntrySummaryAgent } from '@/lib/server/entry-build-prompts'
import { buildEntryAnalyzeSystem } from '@/lib/server/profile-build-prompts'

export type EntryFollowUpResult = {
  shouldAsk: boolean
  purpose: string
  directions: string[]
  voicePrompt: string
}

export type EntrySummaryResult = {
  mainJudgment: string
  facts: string[]
  pendingHypotheses: string[]
  note: string
}

const TITLE_MAP: Record<string, string> = {
  daily: '日常节奏',
  homework: '学习作业',
  communication: '亲子沟通',
  family: '家庭支持',
  study: '学习作业',
  routine: '日常节奏',
  emotion: '亲子沟通',
  environment: '家庭支持',
  final: '四模块综合',
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter(Boolean)
}

function asBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true' || v === 'yes' || v === '1') return true
    if (v === 'false' || v === 'no' || v === '0') return false
  }
  return fallback
}

export function normalizeFollowUp(raw: unknown): EntryFollowUpResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  const candidates = Array.isArray(record.followupCandidates) ? record.followupCandidates : []
  const nested = candidates[0] as Record<string, unknown> | undefined

  const purpose =
    asString(record.purpose) ||
    asString(record.followUpPurpose) ||
    asString(nested?.purpose) ||
    asString(nested?.whyItMatters)

  const voicePrompt =
    asString(record.voicePrompt) ||
    asString(record.followUpQuestion) ||
    asString(record.question) ||
    asString(nested?.question)

  const directions =
    asStringArray(record.directions).length > 0
      ? asStringArray(record.directions)
      : asStringArray(record.directionLabels)

  const shouldAsk = asBoolean(
    record.shouldAsk ?? record.needsFollowup ?? record.needFollowup ?? record.shouldAskFollowup,
    true
  )

  if (!purpose && !voicePrompt) {
    if (!shouldAsk) {
      return {
        shouldAsk: false,
        purpose: '当前信息已够，可以进入阶段整理。若还有您觉得之前没提到、但对理解孩子很关键的信息，欢迎继续补充。',
        directions: [],
        voicePrompt: '',
      }
    }
    return undefined
  }

  return {
    shouldAsk,
    purpose: sanitizeForParent(purpose || voicePrompt),
    directions: directions.slice(0, 4).map((d) => sanitizeForParent(d)),
    voicePrompt: sanitizeForParent(voicePrompt || purpose),
  }
}

export function normalizeSummary(raw: unknown): EntrySummaryResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>

  const mainJudgment =
    asString(record.mainJudgment) ||
    asString(record.summary) ||
    asString(record.stageSummary)

  if (!mainJudgment) return undefined

  const facts = asStringArray(record.facts).length > 0
    ? asStringArray(record.facts)
    : asStringArray(record.verifiableFacts)

  const pendingHypotheses = asStringArray(record.pendingHypotheses).length > 0
    ? asStringArray(record.pendingHypotheses)
    : asStringArray(record.hypotheses)

  return {
    mainJudgment: sanitizeForParent(mainJudgment),
    facts: facts.slice(0, 4).map((f) => sanitizeForParent(f)).filter(Boolean),
    pendingHypotheses: pendingHypotheses
      .slice(0, 3)
      .map((h) => sanitizeForParent(h))
      .filter(Boolean),
    note: sanitizeForParent(asString(record.note) || asString(record.nextObservation)),
  }
}

export function fastAiFailureMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('402') || /insufficient balance/i.test(msg)) {
    return 'AI 服务暂时不可用（账户余额不足），请稍后联系管理员处理。'
  }
  if (msg.includes('401') || msg.includes('403')) {
    return 'AI 服务鉴权失败，请稍后联系管理员处理。'
  }
  if (msg.includes('429')) {
    return 'AI 服务请求过于频繁，请稍后再试。'
  }
  if (msg.includes('FAST_AI_JSON_PARSE_FAILED') || msg.includes('FAST_AI_EMPTY_OUTPUT')) {
    return 'AI 返回格式异常，请稍后再试。'
  }
  return '这一步暂时没有整理成功，可以稍后再试。'
}

export async function runEntryFollowUp(entryType: string, rawText: string) {
  const topic = TITLE_MAP[entryType] || entryType
  const agent = resolveEntryFollowUpAgent(entryType)
  const isFinal = entryType === 'final'
  let lastError: unknown
  const raw = await callFastJson<Record<string, unknown>>(buildEntryAnalyzeSystem(agent), {
    task: `家长在「${topic}」入口输入了以下描述。请判断是否需要继续追问，并生成追问内容。只输出 JSON。`,
    entryType,
    topic,
    rawText: isFinal ? rawText.slice(0, 6000) : rawText.slice(0, 4000),
  }, { maxTokens: isFinal ? 1200 : 900 }).catch((error) => {
    lastError = error
    return undefined
  })

  const normalized = normalizeFollowUp(raw)
  return { result: normalized, error: normalized ? undefined : lastError }
}

export async function runEntrySummary(entryType: string, rawText: string) {
  const topic = TITLE_MAP[entryType] || entryType
  const agent = resolveEntrySummaryAgent(entryType)
  let lastError: unknown
  const raw = await callFastJson<Record<string, unknown>>(buildEntryAnalyzeSystem(agent), {
    task: `家长在「${topic}」入口完成了描述（含可能的追问补充）。请写阶段总结。只输出 JSON。`,
    entryType,
    topic,
    rawText: rawText.slice(0, 5000),
  }, { maxTokens: 1400 }).catch((error) => {
    lastError = error
    return undefined
  })

  const normalized = normalizeSummary(raw)
  return { result: normalized, error: normalized ? undefined : lastError }
}

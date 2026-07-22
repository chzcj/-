import type { OrchestrationOutput } from '@/types/database'
import {
  frontendReadPackHasContent,
  pickFrontendReadPack,
  type FrontendReadSchema,
} from '@/lib/server/daily/frontend-read-pack'
import type { DeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { pickTurnRelevantSnippets } from '@/lib/server/daily/turn-relevant-snippets'

export type ProseMode = 'analysis' | 'light'

/**
 * v4.1 重推理深度：analysis 预算按材料厚度分档——
 * 有 dossier 切片/机制叙述/原子事实撑住时给 360 字（讲透机制在本场景怎么运作），
 * 材料薄时 240 字（防止高预算邀请空话）。light 不变。
 */
const PROSE_MAX = {
  analysisDeep: 360,
  analysisBase: 240,
  light: 100,
} as const

/** 本轮是否有足以支撑深推理的材料（dossier 主源 / digest 机制叙述 / ≥2 条原子事实） */
export function hasDeepMaterial(
  ctx: OrchestrationOutput['retrievedContext'],
  digest?: DeepModelDigestPack
): boolean {
  if ((ctx.dossierSlice || []).length > 0) return true
  if (digest?.mechanismNarrative?.trim()) return true
  if ((ctx.domainAtomFacts || []).length >= 2) return true
  return false
}

const UNDERSTAND_HINT =
  /怎么办|该怎么做|为什么|怎么回事|到底|总不能|是不是|怎么回事|搞不定|不懂|理解/
const EMOTION_HINT = /吼|难受|忍不住|吵架|夹在|崩溃|内疚|烦死了|气死/
const SHORT_ACK = /^[\s\S]{0,14}$/

/** 启发式 prose 路由（建议性；proseMode 是字数预算，以本轮一个重点为准） */
export function resolveProseRouting(
  output: OrchestrationOutput,
  userText = ''
): { mode: ProseMode; reason: string } {
  const rel = output.relationshipToExistingModel.type
  const route = output.routingDecision.frontResponseType
  const text = userText.trim()

  if (rel === 'counter_evidence' || route === 'profile_update_notice') {
    return { mode: 'light', reason: '轻确认/记录类路由' }
  }
  if (output.inputType === 'risk_followup') {
    return { mode: 'analysis', reason: '安全跟进需展开' }
  }
  if (rel === 'new_mechanism_signal') {
    return { mode: 'light', reason: '新机制信号需轻量追问' }
  }

  const low =
    output.routingDecision.needFollowup ||
    rel === 'insufficient' ||
    route === 'one_key_followup'
  if (low) {
    return { mode: 'light', reason: '信息不足或编排建议追问' }
  }
  if (output.inputType === 'ask_advice') {
    return { mode: 'analysis', reason: '家长要方法' }
  }

  const wantsUnderstand = UNDERSTAND_HINT.test(text)
  const strongEmotion = EMOTION_HINT.test(text)
  const longNarrative = text.length >= 36
  const modelExplain =
    route === 'model_based_explanation' || route === 'advice_from_dossier'
  const familiarPattern =
    rel === 'old_mechanism_repetition' ||
    rel === 'new_supporting_evidence' ||
    rel === 'pending_hypothesis_evidence'
  const substantive =
    wantsUnderstand || strongEmotion || longNarrative || (modelExplain && familiarPattern)

  if (substantive) {
    const parts: string[] = []
    if (wantsUnderstand) parts.push('求搞懂/要办法')
    if (strongEmotion) parts.push('强情绪')
    if (longNarrative) parts.push('长叙述')
    if (modelExplain && familiarPattern) parts.push('模型解释+熟悉模式')
    return { mode: 'analysis', reason: `实质叙述（${parts.join('+') || '默认'}）` }
  }

  if (SHORT_ACK.test(text) && !strongEmotion) {
    return { mode: 'light', reason: '短确认/短回应' }
  }

  return { mode: 'light', reason: '默认轻回应（短 scene_report）' }
}

export function resolveProseMode(output: OrchestrationOutput, userText = ''): ProseMode {
  return resolveProseRouting(output, userText).mode
}

export function proseCharLimit(mode: ProseMode, deepMaterial = false): number {
  if (mode === 'light') return PROSE_MAX.light
  return deepMaterial ? PROSE_MAX.analysisDeep : PROSE_MAX.analysisBase
}

const PACK_FIELD_GUIDE: Record<string, string> = {
  childStructureModels: '孩子结构画像片段 — 讲透时可参考',
  entryEvidence: '五入口证据包摘要 — 引用具体场景',
  entryFacts: '四模块具体事实 — 须通读全部条目；可择与本题最相关的一条融入',
  dossierSlice: '整合理解底稿切片（主源）— 按本轮问题选取；优先于 matchedMechanisms',
  domainAtomFacts: 'v4 原子事实网络 — 按问题域检索的高价值 atom；回答细场景时必须引用 ≥2 条',
  recentEvents: '近期对话或事件片段 — 体现「越来越认识这个孩子」',
  pendingHypotheses: '内部待验证方向 — 翻译成生活语言，禁止输出字段感',
  matchedMechanisms: '兜底离散模式卡 — 仅 dossierSlice 缺失时使用，禁止理论卡名',
  familyPatterns: '家庭互动模式 — 用差异描述，不审判家长',
  parentUnderstanding: '家长侧理解信号 — 宜用来调整语气与切入点',
  childQuotes: '孩子原话 — 可自然复用其用词，禁止编造',
  parentVerbatimSnippets: '家长原话片段 — 接住家长怎么说的，禁止评判',
  turnRelevantSnippets: '本轮切入提示（3–5 条）— 入口 only；写 prose 前仍须通读 retrievalPack 与 deepModelDigest',
}

function packHasContent(ctx: OrchestrationOutput['retrievedContext']): boolean {
  return frontendReadPackHasContent(pickFrontendReadPack(ctx))
}

function buildPackStats(
  retrievalPack: FrontendReadSchema,
  digest?: DeepModelDigestPack
): Record<string, number> {
  const stats: Record<string, number> = {}
  for (const [key, arr] of Object.entries(retrievalPack)) {
    if (Array.isArray(arr) && arr.length > 0) stats[key] = arr.length
  }
  if (digest) {
    if (digest.mechanismNarrative?.trim()) stats.mechanismNarrative = 1
    if (digest.interactionLoops?.length) stats.interactionLoops = digest.interactionLoops.length
    if (digest.anchoredFacts?.length) stats.digestAnchoredFacts = digest.anchoredFacts.length
    if (digest.childQuotes?.length) stats.digestChildQuotes = digest.childQuotes.length
  }
  return stats
}

/** 结构化上下文包：稳定 SP 在 system，动态 pack 在 user payload（利于 prompt cache）。 */
export function buildDailyProsePayload(
  output: OrchestrationOutput,
  userText: string,
  options?: { deepModelDigest?: DeepModelDigestPack }
) {
  const ctx = output.retrievedContext
  const route = output.routingDecision
  const rel = output.relationshipToExistingModel
  const { mode, reason } = resolveProseRouting(output, userText)
  const hasPack = packHasContent(ctx)

  const retrievalPack = pickFrontendReadPack(ctx)
  const turnRelevantSnippets = pickTurnRelevantSnippets(userText, retrievalPack, 5)
  const digest = options?.deepModelDigest
  const packStats = buildPackStats(retrievalPack, digest)

  return {
    packReadingGuide: PACK_FIELD_GUIDE,
    packStats,
    retrievalPack,
    deepModelDigest: digest,
    // v4：家庭个性化视角配置（SP §二十五 persona 适配用）
    familyAgentPersona: output.familyAgentPersona || null,
    writingRules: {
      outputOnlyProse: true,
      noJsonNoHeadings: true,
      noRepeatSectionContent: true,
      mustReadFullPack: true,
      mustReadFullDigest: Boolean(digest),
      turnRelevantSnippetsAreEntryHintOnly: true,
      singleFocusSuggested: true,
      suggestMechanismDepth:
        mode === 'analysis' || output.inputType === 'ask_advice' || UNDERSTAND_HINT.test(userText),
      tone: '读过档案的老教师面谈；每轮一个重点；说人话',
      internalFieldsForRoutingOnly: [
        'relationshipType',
        'responseType',
        'suggestedFollowup',
        'maturityLevel',
        'proseModeReason',
      ],
    },
    userText,
    turnRelevantSnippets,
    proseMode: mode,
    proseModeReason: reason,
    proseModeNote: 'proseMode/maxChars 是字数预算建议；以本轮一个重点实际需要为准，但不得超过 maxChars',
    maxChars: proseCharLimit(mode, hasDeepMaterial(ctx, digest)),
    inputType: output.inputType,
    maturityLevel: output.contextMaturityLevel,
    relationshipType: rel.type,
    responseType: route.frontResponseType,
    suggestedFollowup: route.followupQuestion || undefined,
    hasRetrievalPack: hasPack,
  }
}

export function buildDailyProseTask(output: OrchestrationOutput, userText = ''): string {
  const mode = resolveProseMode(output, userText)
  const deep = hasDeepMaterial(output.retrievedContext)
  const max = proseCharLimit(mode, deep)

  const lines = [
    '你正在生成交流页「正文 prose」——老教师读过 pack 与 digest 后，当面答家长**这一轮**的问题；抓一个重点讲清楚，不必讲全、不必套固定结构。',
    '结构化 section 会另外渲染；正文不得重复 section 里的列表和长篇分析。',
    '',
    '【硬约束】',
    `1. 全文字数上限 ${max} 字（含标点）。须在字数内写完；宁可删次要句，不要写超长。`,
    '2. 动笔前须通读 retrievalPack 每个非空字段的全部条目 + deepModelDigest（若有）；看 packStats 了解各字段条数；turnRelevantSnippets 只是切入提示。',
    '3. 禁止编造 pack 里没有的细节；禁止泛泛育儿建议。',
    '4. 只输出中文正文：无 JSON、无标题、无 markdown、无「作为 AI」口吻；禁止口播「这里想区分…后面处理不一样」。',
  ]

  if (mode === 'analysis') {
    lines.push(
      deep
        ? '【建议】分析轮（材料充足）：直接答本题，把一个重点**讲透**——机制在这个场景里怎么运作（谁做了什么→孩子怎么接收→行为在保护什么），引 1-2 条本家庭事实/原话作锚点；把握不足处给一句替代解释或区分观察（「如果是 A，应该会看到…」）。仍只讲一个重点，人话、无术语。'
        : '【建议】分析轮：直接答本题；若材料够，可用一两句讲透一个关键点（人话、无术语）；不必类型标签、不必面面俱到。'
    )
  } else if (output.inputType === 'ask_advice') {
    lines.push('【建议】要方法：不宜只追问；可给一个小步或方向，细节留给 section。')
  } else {
    lines.push('【建议】轻回应：宜短，只留最有用的一刀（接住 / 一点连接 / 记一笔，任选）。')
  }

  lines.push(
    '',
    '【动笔前内心顺序（不输出）】通读全部 pack → 形成这户短画像 → 预判家长目的 → 选一个重点 → 说人话写出。',
    `【再次提醒】不得超过 ${max} 字；只答一个重点。`
  )

  return lines.join('\n')
}

export type ClampProseMeta = {
  traceId?: string
  familyId?: string
}

export function clampProse(text: string, mode: ProseMode, meta?: ClampProseMeta): string {
  // 安全网按该 mode 的最大档钳制：真实预算（薄 240/厚 360）由任务指令约束 LLM，
  // 硬截断只兜底严重超长，避免薄材料轮把合规的 250 字砍出残句。
  const max = proseCharLimit(mode, true)
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed

  if (meta) {
    console.warn('[prose:clamp]', {
      ...meta,
      mode,
      originalLen: trimmed.length,
      max,
    })
  }

  const slice = trimmed.slice(0, max)
  const lastStop = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？')
  )
  if (lastStop > max * 0.55) return slice.slice(0, lastStop + 1)
  return `${slice.trim()}…`
}

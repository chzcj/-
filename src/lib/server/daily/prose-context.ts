import type { OrchestrationOutput } from '@/types/database'

export type ProseMode = 'follow_up' | 'analysis' | 'light'

const PROSE_MAX: Record<ProseMode, number> = {
  follow_up: 100,
  analysis: 200,
  light: 80,
}

export function resolveProseMode(output: OrchestrationOutput): ProseMode {
  const rel = output.relationshipToExistingModel.type
  const route = output.routingDecision.frontResponseType

  if (rel === 'counter_evidence' || route === 'profile_update_notice') return 'light'
  if (output.inputType === 'risk_followup') return 'analysis'
  if (rel === 'new_mechanism_signal') return 'follow_up'

  const low =
    output.routingDecision.needFollowup ||
    rel === 'insufficient' ||
    route === 'one_key_followup'
  if (low) return 'follow_up'
  if (output.inputType === 'ask_advice') return 'analysis'
  return 'light'
}

export function proseCharLimit(mode: ProseMode): number {
  return PROSE_MAX[mode]
}

const PACK_FIELD_GUIDE: Record<string, string> = {
  childStructureModels: '孩子结构画像片段（习惯、触发点、应对方式）— 优先引用',
  entryEvidence: '五入口证据包摘要（学习/作息/沟通/情绪/环境）— 引用具体场景',
  entryFacts: '四模块采集的具体事实（可验证事实/孩子行为/触发点）— 必须引用其中至少一条具体场景，禁止泛泛建议',
  recentEvents: '近期对话或事件片段 — 用来体现「越来越认识这个孩子」',
  pendingHypotheses: '内部待验证方向 — 翻译成生活语言，禁止输出字段感',
  matchedMechanisms: '内部匹配模式 — 翻译成「可能更像…」，禁止「机制」二字',
  familyPatterns: '家庭互动模式 — 用差异描述，不审判家长',
  parentUnderstanding: '家长侧理解信号（目标/焦虑/习惯/偏好）— 用来调整语气与切入点，禁止评判家长',
}

function packHasContent(ctx: OrchestrationOutput['retrievedContext']): boolean {
  return (
    (ctx.relevantChildStructureModel?.length || 0) > 0 ||
    (ctx.relevantEntryEvidencePacks?.length || 0) > 0 ||
    (ctx.entryFacts?.length || 0) > 0 ||
    (ctx.relevantPastEvents?.length || 0) > 0 ||
    (ctx.relevantPendingHypotheses?.length || 0) > 0 ||
    (ctx.matchedMechanisms?.length || 0) > 0 ||
    (ctx.relevantFamilyInteractionPatterns?.length || 0) > 0 ||
    (ctx.childQuotes?.length || 0) > 0 ||
    (ctx.parentNarrativePattern?.length || 0) > 0
  )
}

/** 结构化上下文包：稳定 SP 在 system，动态 pack 在 user payload（利于 prompt cache）。
 *  Prompt cache 优化：payload 字段顺序「稳定前缀在前、动态后缀在后」。
 *  DeepSeek/Ark 按 byte-identical 前缀缓存，同一家庭连续多轮交流时，system + 稳定 pack 前缀命中缓存（~1/10 价），
 *  仅 recentEvents/userText/proseMode 等动态尾部重算。retrievalPack 内部也按稳定→动态排键序。 */
export function buildDailyProsePayload(output: OrchestrationOutput, userText: string) {
  const ctx = output.retrievedContext
  const route = output.routingDecision
  const rel = output.relationshipToExistingModel
  const mode = resolveProseMode(output)
  const hasPack = packHasContent(ctx)

  // retrievalPack：稳定子字段在前（跨轮不变），动态子字段在后（每轮变）
  const retrievalPack = {
    childStructureModels: ctx.relevantChildStructureModel?.slice(0, 4) || [],
    entryEvidence: ctx.relevantEntryEvidencePacks?.slice(0, 4) || [],
    entryFacts: ctx.entryFacts?.slice(0, 6) || [],
    matchedMechanisms: ctx.matchedMechanisms?.slice(0, 3) || [],
    familyPatterns: ctx.relevantFamilyInteractionPatterns?.slice(0, 2) || [],
    parentUnderstanding: ctx.parentNarrativePattern?.slice(0, 6) || [],
    // 动态尾部：近期事件 + 待验证假设每轮可能变
    recentEvents: ctx.relevantPastEvents?.slice(0, 5) || [],
    pendingHypotheses: ctx.relevantPendingHypotheses?.slice(0, 3) || [],
  }

  return {
    // === 稳定前缀（跨轮可命中 prompt cache）===
    packReadingGuide: PACK_FIELD_GUIDE,
    retrievalPack,
    writingRules: {
      outputOnlyProse: true,
      noJsonNoHeadings: true,
      noRepeatSectionContent: true,
      citeRetrievalRequired: hasPack,
      followUpMustStateDistinction: mode === 'follow_up',
      tone: '清北师兄/师姐和家长面谈：先接现场，不急着定性',
      internalFieldsForRoutingOnly: [
        'relationshipType',
        'responseType',
        'suggestedFollowup',
        'maturityLevel',
      ],
    },
    // === 动态后缀（每轮变化，量小）===
    userText,
    proseMode: mode,
    maxChars: proseCharLimit(mode),
    inputType: output.inputType,
    maturityLevel: output.contextMaturityLevel,
    relationshipType: rel.type,
    responseType: route.frontResponseType,
    suggestedFollowup: route.followupQuestion || undefined,
  }
}

export function buildDailyProseTask(output: OrchestrationOutput): string {
  const mode = resolveProseMode(output)
  const max = proseCharLimit(mode)
  const rel = output.relationshipToExistingModel.type

  const lines = [
    '你正在生成交流页「正文 prose」——它是家长最先看到的、有人味的短回复。',
    '结构化 section（判断依据/画像分析/孩子视角等）会由系统另外渲染，**正文不得重复 section 里的列表和长篇分析**。',
    '',
    '【硬约束】',
    `1. 全文字数上限 ${max} 字（含标点）。超出会被截断。`,
    '2. 必须先完整阅读 retrievalPack 中四块检索材料；若材料非空，正文至少融入其中一条具体信息（场景/习惯/过往片段），禁止泛泛育儿建议。',
    '3. 只输出这一段中文正文，不要 JSON、不要标题、不要 markdown、不要「作为 AI」口吻。',
  ]

  if (mode === 'follow_up') {
    lines.push(
      '4. 低置信/追问轮：正文极短（一两句即可），把关键追问留给 section；若需追问，先说明「想区分 A 还是 B」。'
    )
  } else if (mode === 'analysis') {
    lines.push('4. 高置信分析轮：给出有家庭情境感的一句理解或承接，不展开长诊断（诊断在 section）。')
  } else {
    lines.push('4. 轻回应：简短确认收到，可点出与检索材料的一个连接。')
  }

  return lines.join('\n')
}

export function clampProse(text: string, mode: ProseMode): string {
  const max = proseCharLimit(mode)
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  const slice = trimmed.slice(0, max)
  const lastStop = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'))
  if (lastStop > max * 0.55) return slice.slice(0, lastStop + 1)
  return `${slice.trim()}…`
}

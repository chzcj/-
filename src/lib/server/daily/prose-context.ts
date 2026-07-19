import type { OrchestrationOutput } from '@/types/database'
import {
  frontendReadPackHasContent,
  pickFrontendReadPack,
} from '@/lib/server/daily/frontend-read-pack'
import type { DeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'

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
  dossierSlice: '整合理解底稿切片（主源）— 交织、无术语、按本轮问题选取；优先于 matchedMechanisms',
  recentEvents: '近期对话或事件片段 — 用来体现「越来越认识这个孩子」',
  pendingHypotheses: '内部待验证方向 — 翻译成生活语言，禁止输出字段感',
  matchedMechanisms: '兜底：离散机制人话卡 — 仅 dossierSlice 缺失时使用，禁止理论卡名',
  familyPatterns: '家庭互动模式 — 用差异描述，不审判家长',
  parentUnderstanding: '家长侧理解信号（目标/焦虑/习惯/偏好）— 用来调整语气与切入点，禁止评判家长',
  childQuotes: '孩子原话 — 可自然复用其用词，禁止编造',
  parentVerbatimSnippets: '家长原话片段 — 接住家长怎么说的，禁止评判',
}

function packHasContent(ctx: OrchestrationOutput['retrievedContext']): boolean {
  return frontendReadPackHasContent(pickFrontendReadPack(ctx))
}

/** 结构化上下文包：稳定 SP 在 system，动态 pack 在 user payload（利于 prompt cache）。
 *  Prompt cache 优化：payload 字段顺序「稳定前缀在前、动态后缀在后」。
 *  DeepSeek/Ark 按 byte-identical 前缀缓存，同一家庭连续多轮交流时，system + 稳定 pack 前缀命中缓存（~1/10 价），
 *  仅 recentEvents/userText/proseMode 等动态尾部重算。retrievalPack 内部也按稳定→动态排键序。 */
export function buildDailyProsePayload(
  output: OrchestrationOutput,
  userText: string,
  options?: { deepModelDigest?: DeepModelDigestPack }
) {
  const ctx = output.retrievedContext
  const route = output.routingDecision
  const rel = output.relationshipToExistingModel
  const mode = resolveProseMode(output)
  const hasPack = packHasContent(ctx)

  // retrievalPack：前端 AI 只读子集（见 docs/contracts/read-contract.md + frontend-read-pack.ts）
  const retrievalPack = pickFrontendReadPack(ctx)

  return {
    // === 稳定前缀（跨轮可命中 prompt cache）===
    packReadingGuide: PACK_FIELD_GUIDE,
    retrievalPack,
    deepModelDigest: options?.deepModelDigest,
    writingRules: {
      outputOnlyProse: true,
      noJsonNoHeadings: true,
      noRepeatSectionContent: true,
      citeRetrievalRequired: hasPack || Boolean(options?.deepModelDigest?.anchoredFacts?.length),
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
      '4. 低置信/追问轮：正文极短（一两句即可），概括只到「这一幕」层面（如「今晚这一幕，卡的是开工，不是能力」），不下孩子类型判断；把关键追问留给 section；若需追问，先说明「想区分 A 还是 B」。'
    )
  } else if (mode === 'analysis') {
    lines.push(
      '4. 高置信分析轮：第二句必须是「对孩子的概括」（这孩子…/你家孩子…/说白了…，家长能记住、能转述），概括优先取材 deepModelDigest.mechanismNarrative 或 retrievalPack.childStructureModels（后台已验证的判断，翻译成人话）；不展开长诊断（诊断在 section）。'
    )
  } else {
    lines.push('4. 轻回应：简短确认收到，可点出与检索材料的一个连接；无需强行概括。')
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

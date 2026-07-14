import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { callFastJson } from '@/lib/server/ark-agents'
import { getTurnEventByTraceId } from '@/lib/server/memory/database-manager'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import {
  deepModelDigestHasContent,
  pickDeepModelDigestPack,
} from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { pickFrontendReadPack } from '@/lib/server/daily/frontend-read-pack'
import type { RetrievedContext } from '@/types/database'
import type { DailySection } from '@/types/daily-message'

type TurnPack = {
  sections?: DailySection[]
}

type HowToSpeakOpening = {
  wording: string
  reason: string
}

type HowToSpeakResult = {
  intro?: string
  openings: HowToSpeakOpening[]
  sections?: Array<{ title: string; body: string }>
}

function sectionPlainText(section: DailySection): string {
  const parts: string[] = []
  if (section.streamingText?.trim()) parts.push(section.streamingText.trim())
  if (section.paragraphs?.length) parts.push(...section.paragraphs)
  if (section.items?.length) parts.push(...section.items)
  if (section.quotes?.length) parts.push(...section.quotes.map((q) => `「${q}」`))
  if (section.note?.trim()) parts.push(section.note.trim())
  return parts.join(' ').trim()
}

function buildFallback(parentText: string, aiReply: string): HowToSpeakResult {
  return {
    intro: '基于刚才的交流，这里有几句可以先试的说法。',
    openings: [
      {
        wording: '我注意到你刚才好像有点烦，我先不催了。你想什么时候开始，我们可以一起定个你能接受的时间。',
        reason: '先承认感受、撤掉压力，再邀请孩子参与决定，比直接追问「什么时候开始写」更容易接话。',
      },
      {
        wording: '今晚作业里，你觉得哪一项最难？我们可以先只碰那一项，别的先放一放。',
        reason: '把「全部作业」拆成一小块，降低启动门槛，也让孩子感到你在帮他而不是在盯进度。',
      },
    ],
    sections: aiReply
      ? [{ title: '刚才的交流要点', body: aiReply.slice(0, 280) }]
      : undefined,
  }
}

function normalizeResult(
  raw: Partial<HowToSpeakResult> | undefined,
  parentText: string,
  aiReply: string
): HowToSpeakResult {
  const fallback = buildFallback(parentText, aiReply)
  const openings = (raw?.openings || [])
    .map((item) => ({
      wording: typeof item?.wording === 'string' ? item.wording.trim() : '',
      reason: typeof item?.reason === 'string' ? item.reason.trim() : '',
    }))
    .filter((item) => item.wording && item.reason)
    .slice(0, 4)

  const sections = (raw?.sections || [])
    .map((item) => ({
      title: typeof item?.title === 'string' ? item.title.trim() : '',
      body: typeof item?.body === 'string' ? item.body.trim() : '',
    }))
    .filter((item) => item.title && item.body)
    .slice(0, 3)

  return {
    intro: typeof raw?.intro === 'string' && raw.intro.trim() ? raw.intro.trim() : fallback.intro,
    openings: openings.length >= 2 ? openings : fallback.openings,
    sections: sections.length ? sections : fallback.sections,
  }
}

function flattenParentUnderstanding(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (!raw || typeof raw !== 'object') return []
  return Object.values(raw as Record<string, unknown>)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .map(String)
    .filter(Boolean)
}

function packetToRetrievedContext(
  packet: Awaited<ReturnType<typeof buildDailyDialogueRetrievalPacket>>
): RetrievedContext {
  return {
    relevantChildStructureModel: packet.relevantChildStructureModels || [],
    relevantEntryEvidencePacks: packet.entryEvidencePackSummaries?.length
      ? packet.entryEvidencePackSummaries
      : packet.supportingEvidence || [],
    relevantPastEvents: packet.recentRelatedEvents || [],
    relevantPendingHypotheses: packet.pendingHypotheses || [],
    relevantFamilyInteractionPatterns: packet.familyInteractionPatterns || [],
    matchedMechanisms: packet.matchedMechanisms || [],
    recentDiagnosis: [],
    parentNarrativePattern: flattenParentUnderstanding(packet.parentNarrativePattern),
    childQuotes: packet.childQuotes || [],
    parentVerbatimSnippets: packet.parentVerbatimSnippets || [],
    entryFacts: packet.entryFacts || [],
  }
}

function emptyRetrievedContext(): RetrievedContext {
  return {
    relevantChildStructureModel: [],
    relevantEntryEvidencePacks: [],
    relevantPastEvents: [],
    relevantPendingHypotheses: [],
    relevantFamilyInteractionPatterns: [],
    matchedMechanisms: [],
    recentDiagnosis: [],
    parentNarrativePattern: [],
    childQuotes: [],
    parentVerbatimSnippets: [],
    entryFacts: [],
  }
}

function buildFamilyMemoryBlock(
  pack: ReturnType<typeof pickFrontendReadPack>,
  digest: ReturnType<typeof pickDeepModelDigestPack>
): string {
  const lines: string[] = []
  if (digest.mechanismNarrative) lines.push(`机制叙事：${digest.mechanismNarrative.slice(0, 800)}`)
  if (digest.structuralTensions.length) {
    lines.push(`结构张力：${digest.structuralTensions.slice(0, 6).join('；')}`)
  }
  if (digest.interactionLoops.length) {
    lines.push(`互动循环：${digest.interactionLoops.slice(0, 8).join('；')}`)
  }
  if (digest.anchoredFacts.length) {
    lines.push(`锚定事实：${digest.anchoredFacts.slice(0, 12).join('；')}`)
  }
  if (pack.entryFacts.length) lines.push(`采集事实：${pack.entryFacts.slice(0, 16).join('；')}`)
  if (pack.matchedMechanisms.length) {
    lines.push(`家庭模式卡：${pack.matchedMechanisms.slice(0, 10).join('；')}`)
  }
  if (pack.childQuotes.length) lines.push(`孩子原话：${pack.childQuotes.slice(0, 8).join('；')}`)
  if (pack.familyPatterns.length) lines.push(`家庭互动：${pack.familyPatterns.slice(0, 6).join('；')}`)
  return lines.join('\n')
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const traceId = typeof body.traceId === 'string' ? body.traceId.trim() : ''
  const fallbackParent = typeof body.parentText === 'string' ? body.parentText.trim() : ''
  const fallbackReply = typeof body.assistantReply === 'string' ? body.assistantReply.trim() : ''

  const tenant = await resolveTenant()
  let parentText = fallbackParent
  let aiReply = fallbackReply
  let sectionSummary = ''

  if (traceId) {
    const event = await getTurnEventByTraceId(tenant, traceId)
    if (!event) {
      if (!parentText) {
        return fail('TURN_NOT_FOUND', '找不到对应交流记录，请回到交流页再试。', undefined, 404)
      }
    } else {
      parentText = event.userMessage?.trim() || parentText
      aiReply = event.assistantReply?.trim() || aiReply
      const pack = event.specializedContextPackSnapshot as TurnPack | undefined
      sectionSummary = (pack?.sections || [])
        .filter((s) => !s.hidden)
        .map((s) => {
          const body = sectionPlainText(s)
          return body ? `${s.label || s.id}：${body}` : ''
        })
        .filter(Boolean)
        .join('\n')
        .slice(0, 800)
    }
  }

  if (!parentText) {
    return fail('BAD_REQUEST', '缺少交流上下文，请从交流页进入。', undefined, 400)
  }

  // 家庭记忆：与 daily/rehearsal 同厚包契约；失败不阻塞「怎么开口」
  let familyMemory = ''
  try {
    const [packet, digest] = await Promise.all([
      buildDailyDialogueRetrievalPacket(parentText, tenant, { fast: true }).catch(() => null),
      loadDeepModelDigest(tenant).catch(() => null),
    ])
    const digestPack = pickDeepModelDigestPack(digest)
    const readPack = packet
      ? pickFrontendReadPack(packetToRetrievedContext(packet))
      : pickFrontendReadPack(emptyRetrievedContext())
    if (
      deepModelDigestHasContent(digestPack) ||
      readPack.entryFacts.length ||
      readPack.matchedMechanisms.length
    ) {
      familyMemory = buildFamilyMemoryBlock(readPack, digestPack).slice(0, 3500)
    }
  } catch (err) {
    console.warn('[daily/how-to-speak] family memory load skipped', err)
  }

  const contextBlock = [
    `家长刚才说：${parentText.slice(0, 600)}`,
    aiReply ? `AI 已回复摘要：${aiReply.slice(0, 600)}` : '',
    sectionSummary ? `结构化解读：\n${sectionSummary}` : '',
    familyMemory
      ? `这个家庭的记忆（说法必须自然引用至少一条具体事实，禁止泛泛育儿）：\n${familyMemory}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const raw = await callFastJson<Partial<HowToSpeakResult>>(
      `你是 ChildOS 的「怎么开口」轻量指南 Agent。家长刚从日常交流页进入，需要 2-4 条可直接对孩子说的开场/接话说法。

规则：
- 每条说法 20-55 字，口语化、可当场说出口，不要写成给 AI 的分析。
- reason 解释为什么这句更稳（≤60 字），结合孩子可能的防御点；若有家庭记忆，至少一条 opening 的 reason 要点到具体家庭事实。
- 不要泛泛「多鼓励」「控制情绪」；要针对本次情境与这个孩子。
- 禁止输出理论卡名、诊断标签、「机制」二字。
- sections 可选 0-2 条，提炼本次交流里最关键的一两个提醒（title ≤12 字，body ≤120 字）。
- intro 一句开场（≤40 字）。

只输出 JSON：
{
  "intro": string,
  "openings": [{ "wording": string, "reason": string }],
  "sections": [{ "title": string, "body": string }]
}`,
      { context: contextBlock },
      { maxTokens: 768 }
    )

    return ok(normalizeResult(raw, parentText, aiReply))
  } catch (error) {
    console.error('[daily/how-to-speak]', error)
    return ok(buildFallback(parentText, aiReply))
  }
}

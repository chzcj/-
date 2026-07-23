import 'server-only'

import type { DeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { stripProfilePlaceholder } from '@/lib/profile/placeholder-text'
import {
  dedupeTextParts,
  isThinPortraitText,
  normalizePortraitCard,
  truncateSummary,
  type DailyPortraitCards,
  type PortraitCardContent,
  type PortraitCardKey,
  type PortraitCardSection,
} from '@/types/portrait-card'

export type { DailyPortraitCards, PortraitCardContent, PortraitCardKey }

/**
 * v4 P0-2c：把后台 structuralTensions 的学术 title 翻译成家长可读语言。
 * 如果 title 是学术化的（含"与""之间""失衡""卷入""纠缠"等），翻译为人话；
 * 如果 title 本身已经是人话，保留原文。
 */
const TENSION_TRANSLATIONS: Array<[RegExp, string]> = [
  [/高情感接纳.*低行为结构|情感.*结构.*失衡/i, '你们很懂孩子的感受，但管学习时的规矩还没立稳'],
  [/三角.*关系|三角化|站队/i, '孩子被夹在大人之间，容易两边看脸色'],
  [/纠缠|过度卷入|界限不清|边界不清/i, '大人和孩子的事搅在一起，孩子自己的空间不够'],
  [/疏离|情感断裂|情感冷漠/i, '家人之间的温度不够，孩子不太愿意主动说心里话'],
  [/控制.*自主|自主.*控制|高压控制/i, '管得紧但孩子自己说了算的空间少'],
  [/期望.*落差|期待.*失配/i, '你们希望的和孩子现在能做的，中间有一段距离'],
  [/依恋.*回避|回避型依恋/i, '孩子遇到难受的事习惯自己扛，不太找大人求助'],
  [/依恋.*矛盾|矛盾型依恋/i, '孩子又想靠近又怕被说，表现出来就是一会儿黏一会儿推开'],
  [/强制循环|coercive/i, '催了才动、不催不动，越催越僵的循环'],
  [/角色.*倒置|父母化|parentification/i, '孩子承担了不该他这个年纪操心的事'],
  [/稳态|homeostasis/i, '家里习惯了这样的节奏，即使不舒服也很难自己改'],
  [/代际.*传递|intergenerational/i, '你们自己成长中经历的模式，不知不觉带到了这一代'],
]

function translateTensionForParent(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  // 如果 title 里已经有人话特征（含"你们""孩子""家里"），不再翻译
  if (/你们|孩子|家里|容易|其实|可能是/.test(trimmed) && trimmed.length < 60) {
    return trimmed
  }

  for (const [re, translation] of TENSION_TRANSLATIONS) {
    if (re.test(trimmed)) return translation
  }

  // 兜底：如果含学术信号词但没匹配到映射，做最小翻译
  if (/失衡|卷入|纠缠|断裂|失配|倒置|稳态|传递|三角/.test(trimmed)) {
    return trimmed.replace(/失衡/g, '不一致').replace(/卷入/g, '卷进来').replace(/纠缠/g, '搅在一起')
  }

  return trimmed
}

/** 处理 structuralTensions 数组：翻译学术 title + 保留 detail 上下文 */
function translateTensionsForParent(tensions: string[]): string[] {
  return tensions.map((t) => {
    // tensionLine 格式是 "title：detail"，翻译 title 保留 detail
    const colonIdx = t.indexOf('：')
    if (colonIdx > 0) {
      const title = t.slice(0, colonIdx)
      const detail = t.slice(colonIdx + 1)
      const translated = translateTensionForParent(title)
      return detail.trim() ? `${translated}（${detail.trim()}）` : translated
    }
    return translateTensionForParent(t)
  })
}

const CARD_KEYS: PortraitCardKey[] = [
  'growth',
  'focus',
  'behavior',
  'interaction',
  'strategies',
  'hypotheses',
  'tensions',
]

function pickFacts(pack: DeepModelDigestPack, max = 3): string[] {
  return pack.anchoredFacts.slice(0, max)
}

function defaultSectionsForKey(
  key: PortraitCardKey,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): PortraitCardSection[] {
  const core = stripProfilePlaceholder(extras?.coreJudgment) || ''
  const support = extras?.supportFocus?.trim() || ''
  const narrative = pack.mechanismNarrative.trim()
  const facts = pickFacts(pack)
  const cultivation = pack.cultivationFocus.trim()

  const byKey: Record<PortraitCardKey, PortraitCardSection[]> = {
    growth: [
      {
        heading: '目前怎么看',
        items: dedupeTextParts([core, narrative].filter(Boolean)).slice(0, 2),
      },
      {
        heading: '你说过的事',
        items: facts.slice(0, 2),
      },
    ],
    focus: [
      {
        heading: '眼下可以盯住的一点',
        items: dedupeTextParts([support, cultivation].filter(Boolean)),
      },
    ],
    behavior: [
      {
        heading: '常见反应',
        items: dedupeTextParts(facts),
      },
    ],
    interaction: [
      {
        heading: '家里怎么绕进去的',
        items: dedupeTextParts(pack.interactionLoops),
      },
    ],
    strategies: [
      {
        heading: '可以先试的一小步',
        items: dedupeTextParts([cultivation, support].filter(Boolean)),
      },
    ],
    hypotheses: [
      {
        heading: '写作业时常见卡点',
        items: dedupeTextParts(pack.openHypotheses),
      },
    ],
    tensions: [
      {
        heading: '家里容易绕进去的地方',
        items: translateTensionsForParent(dedupeTextParts(pack.structuralTensions)).slice(0, 4),
      },
    ],
  }

  return byKey[key].filter((s) => s.items.length > 0)
}

function defaultLeadForKey(
  key: PortraitCardKey,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): string {
  const core = stripProfilePlaceholder(extras?.coreJudgment) || ''
  const support = extras?.supportFocus?.trim() || ''
  const narrative = pack.mechanismNarrative.trim()

  const byKey: Record<PortraitCardKey, string> = {
    growth: core || narrative,
    focus: support || pack.cultivationFocus.trim(),
    behavior: pickFacts(pack, 1)[0] || core,
    interaction: pack.interactionLoops[0] || '',
    strategies: support || pack.cultivationFocus.trim(),
    hypotheses: pack.openHypotheses[0] || '',
    tensions: pack.structuralTensions[0] || pack.interactionLoops[0] || '',
  }

  return byKey[key]?.trim() || ''
}

function defaultSummaryForKey(
  key: PortraitCardKey,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): string {
  return truncateSummary(defaultLeadForKey(key, pack, extras))
}

type EnrichExtras = {
  coreJudgment?: string
  supportFocus?: string
  /** LLM 已出人话时只补空，不用 digest 盖写 */
  preferLlm?: boolean
}

/** 补全单卡缺失字段；preferLlm 时尊重 Agent 原文。 */
export function enrichPortraitCardContent(
  key: PortraitCardKey,
  raw: PortraitCardContent | string | undefined,
  pack: DeepModelDigestPack,
  extras?: EnrichExtras
): PortraitCardContent {
  const normalized = normalizePortraitCard(raw)
  const preferLlm = Boolean(extras?.preferLlm)
  const leadFallback = defaultLeadForKey(key, pack, extras)
  const summaryFallback = defaultSummaryForKey(key, pack, extras)
  const sectionFallback = defaultSectionsForKey(key, pack, extras)

  const hasLlmLead = Boolean(normalized?.lead && !isThinPortraitText(normalized.lead))
  const hasLlmSummary = Boolean(normalized?.summary && !isThinPortraitText(normalized.summary))
  const hasLlmSections = Boolean(normalized?.sections?.length)

  if (preferLlm && (hasLlmLead || hasLlmSummary || hasLlmSections)) {
    return {
      summary:
        (hasLlmSummary ? normalized!.summary : truncateSummary(normalized?.lead || summaryFallback)) ||
        '还在了解',
      lead: hasLlmLead ? normalized!.lead : normalized?.lead || undefined,
      sections: hasLlmSections ? normalized!.sections : undefined,
    }
  }

  const lead = hasLlmLead ? normalized!.lead! : leadFallback
  const summary = hasLlmSummary
    ? normalized!.summary!
    : truncateSummary(lead || summaryFallback)
  const sections = hasLlmSections ? normalized!.sections! : sectionFallback

  return {
    summary: summary || '继续交流后，这里会出现更完整的深度分析。',
    lead: lead || undefined,
    sections: sections.length ? sections : undefined,
  }
}

export function enrichPortraitCards(
  cards: DailyPortraitCards | undefined,
  pack: DeepModelDigestPack,
  extras?: EnrichExtras
): DailyPortraitCards {
  const out: DailyPortraitCards = {}
  for (const key of CARD_KEYS) {
    out[key] = enrichPortraitCardContent(key, cards?.[key], pack, extras)
  }
  return out
}

/** @deprecated 使用 enrichPortraitCardContent + buildPortraitCardDetail */
export function enrichPortraitCardBody(
  key: PortraitCardKey,
  body: string | undefined,
  pack: DeepModelDigestPack,
  extras?: { coreJudgment?: string; supportFocus?: string }
): string {
  const card = enrichPortraitCardContent(key, body, pack, extras)
  const parts = dedupeTextParts([
    card.lead || card.summary,
    ...(card.sections || []).flatMap((s) => s.items),
  ])
  return parts.join('\n\n') || card.summary
}

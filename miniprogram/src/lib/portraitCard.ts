/** 画像 Tab 卡片工具，对齐 Web src/types/portrait-card.ts + family-profile 组装逻辑 */

export type PortraitCardKey =
  | 'growth'
  | 'focus'
  | 'behavior'
  | 'interaction'
  | 'strategies'
  | 'hypotheses'
  | 'tensions'

export type PortraitCardSection = {
  heading: string
  items: string[]
}

export type PortraitCardContent = {
  summary: string
  lead?: string
  sections?: PortraitCardSection[]
}

export type DailyPortraitCards = Partial<Record<PortraitCardKey, PortraitCardContent | string>>

export type StructuralTension = {
  title: string
  detail: string
  confidence?: 'low' | 'medium' | 'high'
}

export type HubProfileCard = {
  title: string
  slug: string
  body: string
  progress: number
  progressHint: string
}

const SUMMARY_MAX = 56
const THIN_PLACEHOLDER = /^(还在了解|暂无|继续交流|完成交流|记录、任务|交流积累)/

export function truncateSummary(text: string, max = SUMMARY_MAX): string {
  const value = text.trim()
  if (!value) return ''
  if (value.length <= max) return value
  // 优先在句读处截断，避免半截吞字
  const slice = value.slice(0, max)
  const breakAt = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('；'),
    slice.lastIndexOf('，'),
    slice.lastIndexOf('、'),
    slice.lastIndexOf(' ')
  )
  const cut = breakAt >= Math.floor(max * 0.55) ? slice.slice(0, breakAt + 1) : slice
  return `${cut.replace(/[，,。：:；;]$/, '')}…`
}

export function truncateText(text: string, max = 160): string {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}…`
}

function isThinPortraitText(text: string): boolean {
  const t = text.trim()
  return !t || THIN_PLACEHOLDER.test(t)
}

function normalizePortraitCard(
  raw: PortraitCardContent | string | undefined
): PortraitCardContent | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || isThinPortraitText(trimmed)) return undefined
    return {
      summary: truncateSummary(trimmed),
      lead: trimmed.length > SUMMARY_MAX ? trimmed : undefined,
    }
  }
  const summary = raw.summary?.trim() || ''
  if (!summary && !raw.lead && !raw.sections?.length) return undefined
  return {
    summary: summary ? truncateSummary(summary) : truncateSummary(raw.lead || ''),
    lead: raw.lead?.trim() || undefined,
    sections: raw.sections?.length ? raw.sections : undefined,
  }
}

export function portraitCardSummary(card: PortraitCardContent | string | undefined): string {
  return normalizePortraitCard(card)?.summary || ''
}

export function portraitCardLead(card: PortraitCardContent | string | undefined): string {
  const normalized = normalizePortraitCard(card)
  return normalized?.lead || normalized?.summary || ''
}

/** 取卡的 sections（heading + items），无则空数组；用于子页展开详情。 */
export function portraitCardSections(
  card: PortraitCardContent | string | undefined
): PortraitCardSection[] {
  const normalized = normalizePortraitCard(card)
  return normalized?.sections || []
}

export function cardSummary(
  card: PortraitCardContent | string | undefined,
  fallback: string
): string {
  const fromPortrait = portraitCardSummary(card)
  if (fromPortrait) return fromPortrait
  const fb = fallback.trim()
  return fb ? truncateSummary(fb, 56) : ''
}

export function hasCardContent(
  card: PortraitCardContent | string | undefined,
  fallback = ''
): boolean {
  return Boolean(portraitCardSummary(card) || fallback.trim())
}

export function formatRefreshedAt(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (sameDay) return `今天 ${time}`
    return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`
  } catch {
    return iso
  }
}

export type BuildHubCardsInput = {
  portraitCards: DailyPortraitCards
  hubCards: {
    interactionPattern?: string
    effectiveStrategies?: string
    pendingHypotheses?: string
    behaviorSummary?: string
    hasRealData?: boolean
  }
  structuralTensions: StructuralTension[]
  hasLocalProfile: boolean
  completeness: number
  coreJudgment: string
  supportFocus: string
  currentFocus: string
}

/** 与 Web family-profile/page.tsx profileCards 组装一致 */
export function buildHubProfileCards(input: BuildHubCardsInput): HubProfileCard[] {
  const {
    portraitCards,
    hubCards,
    structuralTensions,
    hasLocalProfile,
    completeness,
    coreJudgment,
    supportFocus,
    currentFocus,
  } = input

  const focusText =
    supportFocus || currentFocus || (hubCards.hasRealData ? '' : '完成交流后，关注点会在这里更新。')
  const growthText =
    hasLocalProfile && coreJudgment
      ? truncateText(coreJudgment, 180)
      : '记录、任务反馈和演练结果都会先成为观察线索，再进入画像更新。'

  return [
    {
      title: '动态成长画像',
      slug: 'growth',
      body: cardSummary(portraitCards.growth, growthText),
      progress: completeness,
      progressHint:
        completeness >= 100
          ? '四个模块都有可验证材料后，画像会标为基本完整；继续交流仍会精修。'
          : completeness >= 75
            ? `已收集有效材料约 ${completeness}%；若某模块信息不足，不会假显示 100%。`
            : `已收集 ${completeness}%，继续交流/补模块会提升完整度。`,
    },
    {
      title: '值得长期关注',
      slug: 'focus',
      body: cardSummary(portraitCards.focus, focusText || truncateText(coreJudgment || '暂无', 80)),
      progress: hasCardContent(portraitCards.focus, focusText) ? 55 : 8,
      progressHint: hasCardContent(portraitCards.focus, focusText)
        ? '已基于已记录交流生成，继续使用会越来越准。'
        : '完成更多交流后，这里会更新。',
    },
    {
      title: '孩子行为模式',
      slug: 'behavior',
      body: cardSummary(
        portraitCards.behavior,
        hubCards.behaviorSummary ||
          (hasLocalProfile && coreJudgment
            ? truncateText(coreJudgment, 120)
            : '交流积累后，会在这里看到模式总结。')
      ),
      progress: hasCardContent(portraitCards.behavior, hubCards.behaviorSummary || '') ? 55 : 8,
      progressHint: hasCardContent(portraitCards.behavior, hubCards.behaviorSummary || '')
        ? '已从交流中提取行为模式，继续记录会持续修正。'
        : '完成几次交流后，这里会出现孩子的行为模式。',
    },
    {
      title: '亲子互动关系',
      slug: 'interaction',
      body: cardSummary(
        portraitCards.interaction,
        hubCards.interactionPattern || (hubCards.hasRealData ? '' : '完成画像与多轮交流后更新。')
      ),
      progress: hasCardContent(portraitCards.interaction, hubCards.interactionPattern || '') ? 55 : 8,
      progressHint: hasCardContent(portraitCards.interaction, hubCards.interactionPattern || '')
        ? '已识别家庭互动循环，多轮交流后会越来越清晰。'
        : '完成画像建模 + 多轮交流后，这里会展示你们家的互动模式。',
    },
    {
      title: '试试这些好方法',
      slug: 'strategies',
      body: cardSummary(
        portraitCards.strategies,
        hubCards.effectiveStrategies ||
          (hubCards.hasRealData ? '' : '来自任务反馈与交流的验证策略会出现在这里。')
      ),
      progress: hasCardContent(portraitCards.strategies, hubCards.effectiveStrategies || '') ? 55 : 8,
      progressHint: hasCardContent(portraitCards.strategies, hubCards.effectiveStrategies || '')
        ? '这些是结合你家情况整理的可试做法。'
        : '试过任务后回来反馈，验证有效的做法会出现在这里。',
    },
    {
      title: '孩子健康成长阻力',
      slug: 'tensions',
      body: cardSummary(
        portraitCards.tensions,
        structuralTensions[0]
          ? truncateSummary(`${structuralTensions[0].title}：${structuralTensions[0].detail}`, 56)
          : ''
      ),
      progress: hasCardContent(
        portraitCards.tensions,
        structuralTensions[0] ? `${structuralTensions[0].title}：${structuralTensions[0].detail}` : ''
      )
        ? 50
        : structuralTensions.length
          ? 40
          : 8,
      progressHint: hasCardContent(
        portraitCards.tensions,
        structuralTensions[0] ? `${structuralTensions[0].title}：${structuralTensions[0].detail}` : ''
      )
        ? '这些运转方式可能在消耗孩子精力，后续交流会继续修正。'
        : structuralTensions.length
          ? '正在把分析整理成更好读的话…'
          : '深度建模完成后，可能消耗孩子的家庭运转方式会出现在这里。',
    },
    {
      title: '孩子写作业的机制',
      slug: 'hypotheses',
      body: cardSummary(
        portraitCards.hypotheses,
        hubCards.pendingHypotheses || (hubCards.hasRealData ? '' : '作业场景下的机制与可试做法会列在这里。')
      ),
      progress: hasCardContent(portraitCards.hypotheses, hubCards.pendingHypotheses || '') ? 40 : 8,
      progressHint: hasCardContent(portraitCards.hypotheses, hubCards.pendingHypotheses || '')
        ? '围绕写作业场景整理机制与做法，后续交流会修正。'
        : '持续交流后，会补充写作业相关的机制与可试做法。',
    },
  ].filter((card) => card.body.trim().length > 0)
}

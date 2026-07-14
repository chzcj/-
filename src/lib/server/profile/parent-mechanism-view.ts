import type {
  CandidateMechanism,
  FamilyInteractionChain,
  PrimaryMechanismChain,
} from '@/types/database'

export type ParentMechanismCardRole = 'primary' | 'secondary'

export type ParentTopMechanismCard = {
  title: string
  insight: string
  fact: string
  role: ParentMechanismCardRole
  protect?: string
}

export type ParentChainCell = {
  label: string
  text: string
}

const THEORY_PREFIX_RE =
  /^(依恋理论|家庭系统|亲职风格|生态系统|ABC-X|双ABC-X|结构式|叙事治疗|认知行为|精神分析|社会学习|自我决定|发展系统|生态系统理论)[（(·\-—:][^）)\-—:]*[）)\-—:]?/u

const ENTRY_KEY_RE =
  /\b(learning_homework|daily_rhythm_phone|parent_child_communication|family_support|emotion_pressure|relationship_environment)\b/gi

const STRENGTH_RANK: Record<string, number> = {
  strong: 3,
  high: 3,
  medium: 2,
  moderate: 2,
  weak: 1,
  low: 0,
}

/** 家长可见面清洗机制标题；库内原文不改 */
export function sanitizeMechanismTitleForParent(raw: string): string {
  let t = (raw || '').trim()
  if (!t) return ''
  t = t.replace(ENTRY_KEY_RE, '')
  // 重复剥理论前缀（如「家庭系统-三角关系：…」）
  for (let i = 0; i < 3; i++) {
    const next = t
      .replace(THEORY_PREFIX_RE, '')
      .replace(/^[\s\-—:：·]+/, '')
      .replace(/^[A-Za-z][\w-]*[：:]\s*/, '')
    if (next === t) break
    t = next
  }
  // 「名：描述」只留名侧短标题
  if (t.includes('：') || t.includes(':')) {
    const head = t.split(/[：:]/)[0]?.trim() || t
    if (head.length >= 2 && head.length <= 28) t = head
  }
  t = t.replace(/机制/g, '模式').trim()
  return t.slice(0, 28)
}

function clipInsight(text: string, max = 90): string {
  const t = (text || '').trim().replace(/\s+/g, '')
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max).replace(/[，,；;：:]$/, '')}…`
}

function strengthRank(s: string | undefined): number {
  return STRENGTH_RANK[(s || '').toLowerCase()] ?? 1
}

function cardFromMechanism(m: CandidateMechanism, role: ParentMechanismCardRole): ParentTopMechanismCard {
  const title = sanitizeMechanismTitleForParent(m.mechanismName) || '家庭互动模式'
  const insight = clipInsight(
    sanitizeMechanismTitleForParent(m.description) === title
      ? m.description
      : m.description || m.applicableScope || title
  )
  const fact = (m.supportingEvidence || []).map((e) => String(e || '').trim()).filter(Boolean)[0] || ''
  const protect = (m.possibleProtectiveFunction || '').trim()
  return {
    title,
    insight: insight || title,
    fact: fact.slice(0, 80),
    role,
    protect: protect ? clipInsight(protect, 40) : undefined,
  }
}

/** 非 low → 主1 + 次4；随 matrix 排序更新 */
export function pickTopMechanismCards(
  matrix: CandidateMechanism[] | null | undefined,
  limit = 5
): ParentTopMechanismCard[] {
  const list = (matrix || [])
    .filter((m) => m.overallStrength !== 'low' && (m.mechanismName || '').trim())
    .slice()
    .sort((a, b) => {
      const d = strengthRank(b.overallStrength) - strengthRank(a.overallStrength)
      if (d !== 0) return d
      // core_candidate 优先
      const typeRank = (t: string) => (t === 'core_candidate' ? 2 : t === 'stage_candidate' ? 1 : 0)
      return typeRank(b.mechanismType) - typeRank(a.mechanismType)
    })
    .slice(0, limit)

  return list.map((m, i) => cardFromMechanism(m, i === 0 ? 'primary' : 'secondary'))
}

const CHAIN_LABELS: Array<{ key: keyof FamilyInteractionChain; label: string }> = [
  { key: 'parentTriggerAction', label: '家长常见动作' },
  { key: 'childReception', label: '孩子可能听到' },
  { key: 'childReaction', label: '孩子怎么反应' },
  { key: 'parentSecondInterpretation', label: '家长二次解读' },
  { key: 'parentReinforcementAction', label: '强化循环' },
  { key: 'childFurtherStrategy', label: '孩子进一步策略' },
  { key: 'longTermEffect', label: '长期影响' },
]

const PRIMARY_CHAIN_LABELS: Array<{ key: keyof PrimaryMechanismChain; label: string }> = [
  { key: 'parentAction', label: '家长常见动作' },
  { key: 'childReception', label: '孩子可能听到' },
  { key: 'childProtectionStrategy', label: '孩子保护策略' },
  { key: 'parentSecondInterpretation', label: '家长二次解读' },
  { key: 'reinforcingAction', label: '强化循环' },
  { key: 'shortTermFunction', label: '短期功能' },
  { key: 'longTermCost', label: '长期代价' },
]

function cellsFromFamilyChain(chain: FamilyInteractionChain | null | undefined): ParentChainCell[] {
  if (!chain) return []
  return CHAIN_LABELS.map(({ key, label }) => {
    const text = String(chain[key] || '').trim()
    if (!text) return null
    return { label, text: text.slice(0, 120) }
  }).filter((c): c is ParentChainCell => Boolean(c))
}

function cellsFromPrimaryChain(chain: PrimaryMechanismChain | null | undefined): ParentChainCell[] {
  if (!chain) return []
  return PRIMARY_CHAIN_LABELS.map(({ key, label }) => {
    const text = String(chain[key] || '').trim()
    if (!text) return null
    return { label, text: text.slice(0, 120) }
  }).filter((c): c is ParentChainCell => Boolean(c))
}

/** 从 deepMechanism 文本兜底：按「标签：内容」行解析，空行跳过 */
export function cellsFromDeepMechanismText(raw: string | null | undefined): ParentChainCell[] {
  const text = (raw || '').trim()
  if (!text) return []
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const cells: ParentChainCell[] = []
  for (const line of lines) {
    const m = line.match(/^([^：:]{2,16})[：:](.+)$/)
    if (!m) continue
    const label = m[1].trim().replace(/机制/g, '模式')
    const body = m[2].trim()
    if (!body) continue
    cells.push({ label, text: body.slice(0, 120) })
  }
  return cells
}

/**
 * 动态最小充分机制链：优先 matrix 顶卡 chain → primaryChain → deepMechanism 文本。
 * 空格隐藏（调用方只渲染返回数组）。
 */
export function pickDynamicChainCells(args: {
  matrix?: CandidateMechanism[] | null
  primaryChain?: PrimaryMechanismChain | null
  deepMechanismText?: string | null
}): ParentChainCell[] {
  const top = (args.matrix || []).find((m) => m.overallStrength !== 'low' && m.familyInteractionChain)
  const fromTop = cellsFromFamilyChain(top?.familyInteractionChain)
  if (fromTop.length) return fromTop

  const fromPrimary = cellsFromPrimaryChain(args.primaryChain)
  if (fromPrimary.length) return fromPrimary

  return cellsFromDeepMechanismText(args.deepMechanismText)
}

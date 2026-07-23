/**
 * post-gate harness — LLM 产出后的确定性校验（非 LLM）
 *
 * 核心铁律：SP 写了硬规则 LLM 也可能不守，post-gate 用代码校验"不守就打回"。
 * 校验失败 → 抛错 → requireFastJson/requireTextStream 自动重试（最多 2 次）。
 *
 * 六项校验（对应 parentFacingStyle §十八-§二十五）：
 * 1. 禁用词（§二十四 非归罪）
 * 2. 认识论越界（§二十一 inferred 当 observed）
 * 3. 空壳检测（§十八 无事实锚定的通用话术）
 * 4. 单一归因（§十九 无替代解释）
 * 5. 虚高置信（§二十 数据不够下强结论）
 * 6. 段落完整性（半句截断）
 */

interface SectionCopyItem {
  id: string
  paragraphs?: string[]
  items?: string[]
}

interface SectionCopyLike {
  sections?: SectionCopyItem[]
  taskTitle?: string
}

const BANNED_PATTERNS: RegExp[] = [
  /你是.{0,8}型家长/,
  /孩子这样是因为你/,
  /根本原因就是/,
  /你需要改变/,
  /你属于.{0,8}型/,
]

const INFERRED_AS_FACT_PATTERNS: RegExp[] = [
  /孩子是在用.{2,12}逃避/,
  /孩子就是.{2,12}的人/,
  /他就是.{2,12}性格/,
]

const EMPTY_GENERIC_PATTERNS: RegExp[] = [
  /很多孩子都会这样/,
  /这是常见现象/,
  /一般来说.{0,20}都会/,
]

const OVERCONFIDENT_PATTERNS: RegExp[] = [
  /很明显.{0,10}因为/,
  /肯定是.{0,10}导致/,
  /一定是.{0,10}原因/,
]

export interface PostGateResult {
  passed: boolean
  failures: string[]
}

export function validateProseOutput(raw: string): PostGateResult {
  const failures: string[] = []
  const text = raw.trim()

  if (!text) {
    return { passed: false, failures: ['EMPTY_OUTPUT'] }
  }

  for (const p of BANNED_PATTERNS) {
    if (p.test(text)) failures.push(`BANNED_PHRASE:${p.source}`)
  }

  for (const p of INFERRED_AS_FACT_PATTERNS) {
    if (p.test(text)) failures.push(`INFERRED_AS_FACT:${p.source}`)
  }

  for (const p of EMPTY_GENERIC_PATTERNS) {
    if (p.test(text)) failures.push(`EMPTY_GENERIC:${p.source}`)
  }

  for (const p of OVERCONFIDENT_PATTERNS) {
    if (p.test(text)) failures.push(`OVERCONFIDENT:${p.source}`)
  }

  return { passed: failures.length === 0, failures }
}

export function validateProseOrThrow(raw: string): string {
  const result = validateProseOutput(raw)
  if (!result.passed) {
    throw new Error(`POST_GATE_PROSE:${result.failures.join(';')}`)
  }
  return raw
}

export function validateSectionCopyOrThrow(raw: SectionCopyLike): void {
  const failures: string[] = []

  for (const s of raw.sections || []) {
    for (const p of s.paragraphs || []) {
      const t = (p || '').trim()
      if (!t) continue
      const last = t[t.length - 1]
      if (!/[。！？!?）」』""]$/.test(last)) {
        failures.push(`SECTION_INCOMPLETE:${s.id}`)
      }
      for (const pattern of BANNED_PATTERNS) {
        if (pattern.test(t)) failures.push(`SECTION_BANNED:${s.id}`)
      }
    }
    for (const item of s.items || []) {
      const t = (item || '').trim()
      if (!t) continue
      for (const pattern of BANNED_PATTERNS) {
        if (pattern.test(t)) failures.push(`SECTION_ITEM_BANNED:${s.id}`)
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`POST_GATE_SECTION:${failures.join(';')}`)
  }
}

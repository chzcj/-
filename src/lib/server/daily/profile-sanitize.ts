/** 禁止进入家长可见文案的画像/测试占位文本 */

const PLACEHOLDER_RE =
  /测试画像|生命周期测试|画像\s*ID|profile[_\s-]?id|^\d{10,}$|178\d{6,}|[A-Za-z0-9]{8,}测试/i

const GENERIC_MODEL_RE = /^当前输入可被已有画像解释\.?$/i

export function isPlaceholderProfileText(text: string | undefined | null): boolean {
  const t = text?.trim()
  if (!t) return true
  if (t.length < 6) return true
  if (PLACEHOLDER_RE.test(t)) return true
  if (GENERIC_MODEL_RE.test(t)) return true
  return false
}

/** 从机制/假设/模式中生成 ≤40 字家长可读摘要 */
export function humanReadableHeadline(args: {
  mechanism?: string
  pattern?: string
  hypothesis?: string
  fallback?: string
}): string {
  const candidates = [args.mechanism, args.pattern, args.hypothesis, args.fallback].filter(Boolean) as string[]
  for (const raw of candidates) {
    const cleaned = raw.replace(/^还在验证：?/, '').trim()
    if (!cleaned || isPlaceholderProfileText(cleaned)) continue
    if (cleaned.length <= 40) return cleaned
    const cut = cleaned.slice(0, 40).replace(/[，,；;：:]$/, '')
    return `${cut}…`
  }
  return '一进入检查或反馈流程，他容易先防御'
}

export function sanitizeForParent(text: string | undefined | null, fallback = ''): string {
  const t = text?.trim()
  if (!t || isPlaceholderProfileText(t)) return fallback
  return t
}

export function humanizeBuiltJudgment(
  judgment: string | undefined | null,
  fallback?: { mechanism?: string; deepMechanism?: string; supportFocus?: string }
): string {
  const t = judgment?.trim()
  if (t && !isPlaceholderProfileText(t)) return t

  const mechanism = sanitizeForParent(fallback?.mechanism)
  const pattern = sanitizeForParent(fallback?.supportFocus)
  const fromDeep = fallback?.deepMechanism
    ?.split('\n')
    .map((l) => l.replace(/^家长常见动作：/, '').trim())
    .find((l) => l.length > 8)

  return humanReadableHeadline({
    mechanism,
    pattern: pattern || fromDeep,
    fallback: '一进入检查或反馈流程，他容易先进入防御',
  })
}

export function filterRetrievalSnippets(snippets: string[], userText: string, max = 3): string[] {
  const junk = /家长打招呼|未提供具体事件|测试画像|生命周期测试/i
  const tokens = userText.match(/[\u4e00-\u9fa5]{2,}/g) || []
  const scored = snippets
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && !junk.test(s))
    .map((s) => {
      let score = 0
      for (const tok of tokens) {
        if (s.includes(tok)) score += 2
      }
      if (s.includes('他说') || s.includes('原话')) score += 1
      return { s, score }
    })
    .sort((a, b) => b.score - a.score)

  const out: string[] = []
  for (const { s, score } of scored) {
    if (score <= 0 && out.length >= 1) continue
    if (out.includes(s)) continue
    out.push(s.length > 120 ? `${s.slice(0, 120)}…` : s)
    if (out.length >= max) break
  }
  return out
}

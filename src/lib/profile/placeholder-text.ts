/** 家长可见画像/分析中的占位与系统恢复文案（前后端共用） */
export const PROFILE_PLACEHOLDER_RE =
  /测试画像|生命周期测试|画像\s*ID|profile[_\s-]?id|从服务器记录恢复|家庭画像已从服务器记录恢复|继续交流即可补充细节|^\d{10,}$|178\d{6,}|[A-Za-z0-9]{8,}测试/i

const GENERIC_MODEL_RE = /^当前输入可被已有画像解释\.?$/i

export function isProfilePlaceholderText(text: string | undefined | null): boolean {
  const t = text?.trim()
  if (!t || t.length < 6) return true
  if (PROFILE_PLACEHOLDER_RE.test(t)) return true
  if (GENERIC_MODEL_RE.test(t)) return true
  return false
}

/** 命中占位时返回空串，供展示层与拼装层统一丢弃 */
export function stripProfilePlaceholder(text: string | undefined | null): string {
  const t = text?.trim()
  if (!t || isProfilePlaceholderText(t)) return ''
  return t
}

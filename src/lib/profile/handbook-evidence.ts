/**
 * 手账「可溯源原话」判定（前后端共享，无 server-only）
 * Top3 / 详情 02 必须同一套：摘要/标签不得冒充原话。
 */

export function looksLikeGenericSummary(text: string): boolean {
  const t = (text || '').trim()
  if (t.length < 8) return true
  if (/本周出现|记录下当前|还在整理|缺少可溯源/.test(t)) return true
  if (/^(交流|预演|任务反馈|画像更新)/.test(t) && t.length < 20) return true
  return false
}

/** 是否算「有可进 Top3 / 可展示 02」的原话证据 */
export function hasTraceableRawEvidence(rawEvidence?: string | null): boolean {
  const raw = (rawEvidence || '').trim()
  if (raw.length < 12) return false
  if (looksLikeGenericSummary(raw)) return false
  return true
}

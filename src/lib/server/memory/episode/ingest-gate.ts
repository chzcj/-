/** 是否跳过 episode_ingest（寒暄/无信息短句，减噪声） */

const GREETING_RE =
  /^(谢谢|多谢|好的+|好哒|你好+|嗯+|哦+|可|行|ok|OK|收到|明白|知道了)[\s!！。~～,，]*$/iu

export function shouldSkipEpisodeIngest(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (t.length >= 12) return false
  if (GREETING_RE.test(t)) return true
  // 纯标点/数字
  if (/^[\d\s!！。~～,，.?？]+$/u.test(t)) return true
  return false
}

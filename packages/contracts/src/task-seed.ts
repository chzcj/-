/** 任务 seed 标题 · Web/MP/BFF 共用（避免二次 normalize 把 rich title 砍碎） */

const TASK_TITLE_BANNED =
  /模式能对上|标记为|观察记录|当前输入|已有画像|写入记忆|判断有更新|待验证|不急着套旧解释|服务器记录恢复/i

const TASK_TITLE_MAX = 48

/** BFF/Agent 已产出的祈使句：轻量清洗 + 截断，不做 firstActionLikeLine 二次抽取 */
export function coerceTaskSeedTitle(raw: string | undefined, fallback: string): string {
  const v = (raw || '').trim().replace(/^["「]|["」]$/g, '')
  if (!v || v.length < 4 || TASK_TITLE_BANNED.test(v)) return fallback
  return v.slice(0, TASK_TITLE_MAX)
}

export function buildTaskReplyExcerpt(
  prose: string,
  sections?: Array<{
    id?: string
    hidden?: boolean
    paragraphs?: string[]
    items?: string[]
  }>
): string {
  const chunks: string[] = []
  for (const s of sections || []) {
    if (s.hidden) continue
    if (s.id === 'advice' || s.id === 'family_structure') {
      chunks.push(...(s.paragraphs || []), ...(s.items || []))
    }
  }
  if (prose.trim()) chunks.push(prose.trim())
  return chunks.filter(Boolean).join('\n\n').slice(0, 1200)
}

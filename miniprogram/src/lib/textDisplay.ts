const MARKDOWN_LIST_PREFIX = /^\s*[-*•]\s+/
const TASK_TITLE_MAX = 24
const TASK_TITLE_BANNED =
  /模式能对上|标记为|观察记录|当前输入|已有画像|写入记忆|判断有更新|待验证|不急着套旧解释|服务器记录恢复/i

export function stripMarkdownForDisplay(value: string): string {
  if (!value) return ''
  return value
    .replace(/\r\n/g, '\n')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .split('\n')
    .map((line) => line.replace(MARKDOWN_LIST_PREFIX, '· ').replace(/\*/g, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 家长可见正文清洗（交流气泡 / section） */
export const stripParentFacingMarkdown = stripMarkdownForDisplay

/** 合并流式片段：兼容「增量 chunk」与「累计全文」两种下发，避免梯形重复 */
export function mergeStreamChunk(prev: string, chunk: string): string {
  if (!chunk) return prev
  if (!prev) return chunk
  if (chunk.startsWith(prev) && chunk.length >= prev.length) return chunk
  if (prev.startsWith(chunk) && chunk.length < prev.length) return prev
  return prev + chunk
}

function firstActionLikeLine(value: string): string {
  const cleaned = stripMarkdownForDisplay(value)
    .replace(/^["“”'「」]+|["“”'「」]+$/g, '')
    .replace(/^(建议|可以|任务|今晚|今天|先做一件事|小步骤)[:：]\s*/, '')
    .trim()

  const lines = cleaned
    .split(/[\n。！？；;]/)
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    lines.find((line) => /^(先|问|说|记录|观察|约定|只做|试|把|等|停|补)/.test(line)) ||
    lines.find((line) => !TASK_TITLE_BANNED.test(line)) ||
    ''
  )
}

export function normalizeTaskTitle(value: string, fallback = '今晚先试一次小步骤'): string {
  const candidate = firstActionLikeLine(value)
  if (!candidate || TASK_TITLE_BANNED.test(candidate)) return fallback

  const withoutAnalysisLead = candidate
    .replace(/^(孩子|家长|妈妈|他|这次|这里)(可能|更像|不是|会|容易).*/, '')
    .trim()

  const normalized = withoutAnalysisLead || candidate
  const actionTitle = /^(先|问|说|记录|观察|约定|只做|试|把|等|停|补|今晚|今天|下次)/.test(normalized)
    ? normalized
    : `先${normalized}`

  return stripMarkdownForDisplay(actionTitle).slice(0, TASK_TITLE_MAX).trim() || fallback
}

/** 任务页 A 版展示字段 · Web/MP 共用（对齐 tasks-mocks/variant-a-soft-sheet.html） */

export type TaskRichFields = {
  sceneLabel?: string
  actionHint?: string
  rationale?: string
}

export type TaskDisplayModel = {
  headline: string
  sceneLabel: string
  actionHint: string
  rationale: string
  sourceLine: string
}

const SCENE_MAX_LEN = 22

/** 场景标签只能是短 pill，禁止整句 observation / title 泄漏 */
function sanitizeSceneLabel(raw: string | undefined, headline: string): string {
  const s = (raw || '').trim()
  if (!s || s.length > SCENE_MAX_LEN) return ''
  if (/[，。！？；、]/.test(s)) return ''
  if (/上次|你一说|要是想聊|然后你|应付|转向|随时叫我|确实有这个/.test(s)) return ''
  if (s === headline) return ''
  const headPrefix = headline.slice(0, Math.min(10, headline.length))
  if (headPrefix.length >= 6 && (s.includes(headPrefix) || headline.includes(s))) return ''
  return s
}

function inferSceneFromObservation(observation: string | undefined, headline: string): string {
  return sanitizeSceneLabel(observation, headline)
}

function formatTaskWhen(createdAt?: string): string {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const time = `${hh}:${mm}`

  if (d.toDateString() === now.toDateString()) return `今天 ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `昨晚 ${time}`

  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`
}

function formatSourceLine(source?: string, createdAt?: string): string {
  const raw = (source || '来自交流').trim()
  const normalized = raw.startsWith('来自') ? raw : `来自${raw}`
  const when = formatTaskWhen(createdAt)
  return when ? `${normalized} · ${when}` : normalized
}

export function normalizeTaskDisplay(
  task: {
    title: string
    source?: string
    observation?: string
    createdAt?: string
  } & TaskRichFields
): TaskDisplayModel {
  const headline = task.title.trim()
  const sceneFromField = sanitizeSceneLabel(task.sceneLabel, headline)
  const sceneLabel = sceneFromField || inferSceneFromObservation(task.observation, headline)

  return {
    headline,
    sceneLabel,
    actionHint: task.actionHint?.trim() || '',
    rationale: task.rationale?.trim() || '',
    sourceLine: formatSourceLine(task.source, task.createdAt),
  }
}

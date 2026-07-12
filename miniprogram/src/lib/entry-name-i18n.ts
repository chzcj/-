/** Entry key → 中文（对齐 Web entry-name-i18n.ts） */

export const ENTRY_NAME_CN: Record<string, string> = {
  learning_homework: '学习与作业',
  daily_rhythm_phone: '日常节奏 / 手机',
  parent_child_communication: '亲子沟通',
  emotional_stress: '情绪压力',
  relationship_environment: '关系环境',
}

const LEGACY_ENTRY_CN: Record<string, string> = {
  daily: '日常节奏',
  homework: '学习作业',
  communication: '亲子沟通',
  family: '家庭支持',
  emotion: '情绪压力',
  environment: '家庭支持',
  study: '学习作业',
  routine: '日常节奏',
}

const ALL_KEY_CN = { ...ENTRY_NAME_CN, ...LEGACY_ENTRY_CN }

export function humanizeEntryRef(text: string): string {
  if (!text) return ''
  let out = text
  const longKeys = Object.keys(ENTRY_NAME_CN).sort((a, b) => b.length - a.length)
  for (const key of longKeys) {
    out = out.replace(new RegExp(`\\b${key}\\b`, 'g'), ENTRY_NAME_CN[key])
  }
  const legacyKeys = Object.keys(LEGACY_ENTRY_CN).sort((a, b) => b.length - a.length)
  for (const key of legacyKeys) {
    out = out.replace(new RegExp(`\\b${key}\\b`, 'g'), LEGACY_ENTRY_CN[key])
  }
  return out
}

/** 机制名/标签人话化：优先整体映射，否则按 entry ref 规则处理 */
export function humanizeMechanismLabel(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''
  if (ALL_KEY_CN[trimmed]) return ALL_KEY_CN[trimmed]
  if (trimmed.includes('+')) {
    return trimmed
      .split('+')
      .map((part) => humanizeMechanismLabel(part.trim()) || part.trim())
      .filter(Boolean)
      .join(' · ')
  }
  return humanizeEntryRef(trimmed)
}

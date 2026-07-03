/**
 * EntryName → 中文模块名映射（前端展示用）。
 *
 * 后端 EntryName 枚举为英文 snake_case（learning_homework 等），L3 fallback 机制名形如
 * `${legacyKey}_local_hypothesis`，synthesis LLM 也可能在 supportingEvidence 里写
 * "daily中...；homework中..."。这些英文 key 直接展示给家长不可读，本模块提供统一的人话化层。
 *
 * 与 constitution.ts 的 chineseName 同源，但 constitution 是 server-only，前端二级页（result/
 * deep/evidence/generating）需要客户端可用，故独立维护一份。
 */

export const ENTRY_NAME_CN: Record<string, string> = {
  learning_homework: '学习与作业',
  daily_rhythm_phone: '日常节奏 / 手机',
  parent_child_communication: '亲子沟通',
  emotional_stress: '情绪压力',
  relationship_environment: '关系环境',
}

// 旧入口/简称 key → 中文（entry/analyze TITLE_MAP 同源 + LLM 常见简称）
const LEGACY_ENTRY_CN: Record<string, string> = {
  daily: '日常节奏',
  daily_rhythm: '日常节奏',
  homework: '学习作业',
  learning: '学习作业',
  study: '学习作业',
  communication: '亲子沟通',
  parent_child: '亲子沟通',
  family: '家庭支持',
  relationship: '关系环境',
  environment: '家庭支持',
  emotion: '情绪压力',
  emotional: '情绪压力',
  stress: '情绪压力',
  routine: '日常节奏',
  final: '四模块综合',
}

const ALL_KEY_CN = { ...ENTRY_NAME_CN, ...LEGACY_ENTRY_CN }

/**
 * 把 "daily_rhythm_phone+learning_homework" 拆开逐个中文化后用「·」连接。
 * 用于 evidence.sourceLabel 里 `${sourceEntries.join('+')} · 跨场景` 的前半段。
 */
export function humanizeJoinedEntries(joined: string): string {
  if (!joined) return '多模块'
  return joined
    .split('+')
    .map((part) => (ALL_KEY_CN[part.trim()] || '').trim() || part.trim())
    .filter(Boolean)
    .join(' · ')
}

/**
 * 把文本里出现的英文 entry key（snake_case 五个 + legacy 简称）原地替换为中文。
 * 处理 "daily中周五作业多时拖延至半夜；homework中作业难时在学校不写" 这类 LLM 输出。
 * 用单词边界匹配，避免误伤普通英文词。
 */
export function humanizeEntryRef(text: string): string {
  if (!text) return ''
  let out = text
  // 先处理长 snake_case（避免被短 key 抢先替换）
  const longKeys = Object.keys(ENTRY_NAME_CN).sort((a, b) => b.length - a.length)
  for (const key of longKeys) {
    out = out.replace(new RegExp(`\\b${key}\\b`, 'g'), ENTRY_NAME_CN[key])
  }
  // 再处理 legacy 简称（daily/homework/communication/family/emotion/environment/study/routine/learning）
  const legacyKeys = Object.keys(LEGACY_ENTRY_CN).sort((a, b) => b.length - a.length)
  for (const key of legacyKeys) {
    out = out.replace(new RegExp(`\\b${key}\\b`, 'g'), LEGACY_ENTRY_CN[key])
  }
  return out
}

/** 取机制名/标签的人话化版本：优先整体映射，否则按 join/ref 规则处理。 */
export function humanizeMechanismLabel(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''
  if (ALL_KEY_CN[trimmed]) return ALL_KEY_CN[trimmed]
  if (trimmed.includes('+')) return humanizeJoinedEntries(trimmed)
  return humanizeEntryRef(trimmed)
}

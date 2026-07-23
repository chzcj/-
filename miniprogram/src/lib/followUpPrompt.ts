import { getEntryConfig } from '@/data/entryConfig'
import type { BuildEntryType } from '@/lib/buildEntries'

export function ensureWantToKnowPrefix(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  if (/^想弄清/.test(trimmed)) return trimmed
  return `想弄清的是：${trimmed.replace(/^[：:\s]+/, '')}`
}

/** 追问页展示文案：始终走模块预设池，按轮次轮换（shouldAsk 仍由 LLM 判定） */
export function resolveFollowUpVoicePrompt(entryType: BuildEntryType | string, round: number): string {
  const config = getEntryConfig(entryType)
  const pool = config.followUpPrompts
  const index = Math.max(0, round - 1) % Math.max(pool.length, 1)
  return pool[index] || pool[0] || '想弄清的是：再补一段具体发生的事，尽量写原话和时间。'
}

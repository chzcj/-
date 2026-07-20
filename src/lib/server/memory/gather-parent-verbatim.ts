import 'server-only'

import { listTurnEvents } from '@/lib/server/memory/database-manager'
import type { TenantId } from '@/lib/server/memory/tenant'

/** 画像 / 手账 / 深度 Agent 读侧：近 N 轮家长原话（默认 20） */
export const PARENT_VERBATIM_WINDOW = 20
/** 单条上限防爆 token；远高于旧 200，保留场景完整度 */
export const PARENT_VERBATIM_MAX_CHARS = 800

export type ParentVerbatimTurn = {
  traceId: string
  text: string
  mode: string
  createdAt: string
}

/**
 * 直读 turn_events.userMessage，按时间倒序取近 limit 轮。
 * 不截断到 200；单条最长 PARENT_VERBATIM_MAX_CHARS。
 * 写侧 DAILY_MEMORY_WRITE_BATCH 仍为 10，本函数只改读侧。
 */
export async function gatherParentVerbatimWindow(
  tenant: TenantId,
  opts?: { limit?: number; maxChars?: number; modes?: string[] }
): Promise<ParentVerbatimTurn[]> {
  const limit = opts?.limit ?? PARENT_VERBATIM_WINDOW
  const maxChars = opts?.maxChars ?? PARENT_VERBATIM_MAX_CHARS
  const modes = opts?.modes

  const turns = await listTurnEvents(tenant, Math.max(limit * 2, 40))
  const out: ParentVerbatimTurn[] = []

  for (const t of turns) {
    if (modes?.length && !modes.some((m) => (t.mode || '').includes(m))) continue
    const raw = (t.userMessage || '').trim()
    if (!raw || raw.length < 2) continue
    const text =
      raw.length <= maxChars
        ? raw
        : `${raw.slice(0, maxChars).replace(/[，,。：:；;]$/, '')}…`
    out.push({
      traceId: t.traceId || t.turnId,
      text,
      mode: t.mode || 'daily_dialogue',
      createdAt: t.createdAt,
    })
    if (out.length >= limit) break
  }

  return out
}

/** 仅文本数组，供现有 Agent payload 兼容 */
export async function gatherParentVerbatimTexts(
  tenant: TenantId,
  opts?: { limit?: number; maxChars?: number }
): Promise<string[]> {
  const rows = await gatherParentVerbatimWindow(tenant, opts)
  return rows.map((r) => r.text)
}

import type { OrchestrationOutput } from '@/types/database'
import type { DailyThinkingChip } from '@/types/daily-message'

/** 从检索上下文装配 thinking 面板四格（对齐 hi-fi profile-chip） */
export function buildThinkingChips(output: OrchestrationOutput): DailyThinkingChip[] {
  const ctx = output.retrievedContext
  const chips: DailyThinkingChip[] = []

  const gradeHint =
    ctx.relevantChildStructureModel?.[0]?.slice(0, 24) ||
    (output.contextMaturityLevel >= 'L3' ? '已有画像' : '画像构建中')
  chips.push({ label: '当前理解', text: gradeHint })

  const scene =
    ctx.relevantPastEvents?.[0]?.slice(0, 28) ||
    ctx.relevantEntryEvidencePacks?.[0]?.slice(0, 28) ||
    '日常互动'
  chips.push({ label: '高频场景', text: scene })

  const learning =
    ctx.relevantChildStructureModel?.[1]?.slice(0, 32) ||
    ctx.matchedMechanisms?.[0]?.slice(0, 32) ||
    '仍在观察'
  chips.push({ label: '学习特点', text: learning })

  const interaction =
    ctx.relevantFamilyInteractionPatterns?.[0]?.slice(0, 32) ||
    ctx.relevantPendingHypotheses?.[0]?.slice(0, 32) ||
    '提醒后易抗拒'
  chips.push({ label: '互动特点', text: interaction })

  return chips.slice(0, 4)
}

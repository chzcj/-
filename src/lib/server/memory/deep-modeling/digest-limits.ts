/** matchedMechanisms / formatMatchedMechanismCards 统一 slice 上限（PR-B4） */
export const MATCHED_MECHANISMS_CARD_LIMIT = 8

/**
 * v4 P1-3b：前台消费 matchedMechanisms 时的 clamp（1 主 + 2 次 = 3 条）。
 * SP 已禁止 LLM 堆砌机制卡，但 BFF 侧也需要硬 clamp 防漏。
 * 用法：在 BFF 注入 SP payload 前调用。
 */
export function clampMatchedMechanismsForFrontend(mechanisms: string[]): string[] {
  return mechanisms.slice(0, 3)
}

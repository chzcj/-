/** L2 brief → L3 active 开场字段，Web/MP 共用 */

export type RehearsalSceneBriefL3 = {
  openingHint: string
  openingChild: string
  openingHintTitle: string
  initialStatusText: string
}

export function pickRehearsalL3Opening(
  brief: Partial<RehearsalSceneBriefL3> | null | undefined,
  scene: {
    openingHint?: string
    openingChild?: string
    openingHintTitle?: string
    summary?: string
  },
  fallbackHintFromUnderstanding?: string
): RehearsalSceneBriefL3 {
  const openingHint =
    brief?.openingHint?.trim() ||
    scene.openingHint?.trim() ||
    fallbackHintFromUnderstanding?.trim() ||
    ''
  const openingChild = brief?.openingChild?.trim() || scene.openingChild?.trim() || '……'
  const openingHintTitle =
    brief?.openingHintTitle?.trim() || scene.openingHintTitle?.trim() || '他可能是这样想的'
  const initialStatusText =
    brief?.initialStatusText?.trim() ||
    (openingHint ? `当前状态：${openingHint.slice(0, 36)}${openingHint.length > 36 ? '…' : ''}` : '')
  return { openingHint, openingChild, openingHintTitle, initialStatusText }
}

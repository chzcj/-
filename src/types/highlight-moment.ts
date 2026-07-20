/** 闪光点：供 L1 计数、L2 moments、L3 shine 详情 */
export type HighlightMoment = {
  id: string
  title: string
  teaser: string
  whyHighlighted: string
  occurredAt: string
  sourceRef?: string
  sourceKind?: 'task' | 'turn' | 'journal' | 'agent'
}

/** 兼容旧 string[] highlights */
export function normalizeHighlightsInput(
  raw: unknown,
  prev?: HighlightMoment[] | string[]
): HighlightMoment[] {
  if (Array.isArray(raw) && raw.length) {
    if (typeof raw[0] === 'string') {
      return (raw as string[])
        .filter((s) => typeof s === 'string' && s.trim())
        .slice(0, 5)
        .map((s, i) => ({
          id: `hl-${i}`,
          title: s.trim().slice(0, 24),
          teaser: s.trim().slice(0, 48),
          whyHighlighted: s.trim(),
          occurredAt: new Date().toISOString(),
          sourceKind: 'agent' as const,
        }))
    }
    return (raw as HighlightMoment[]).slice(0, 5)
  }
  if (prev?.length) {
    if (typeof prev[0] === 'string') {
      return normalizeHighlightsInput(prev as string[])
    }
    return prev as HighlightMoment[]
  }
  return []
}

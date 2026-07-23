/** 建档结果 Hero：coreJudgment + growth summary，Web/MP 共用 */

export function truncateHeroText(text: string, max: number): string {
  const value = text.trim()
  if (!value) return ''
  if (value.length <= max) return value
  const slice = value.slice(0, max)
  const breakAt = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('；'),
    slice.lastIndexOf('，'),
    slice.lastIndexOf(' ')
  )
  if (breakAt > max * 0.45) return slice.slice(0, breakAt + 1).trim()
  return `${slice.trim()}…`
}

export function buildOnboardingResultHero(input: {
  coreJudgment?: string
  growthSummary?: string
}): { kicker: string; title: string; copy: string } {
  const core = input.coreJudgment?.trim() || ''
  const growth = input.growthSummary?.trim() || ''
  return {
    kicker: '画像已生成',
    title:
      truncateHeroText(core, 30) ||
      truncateHeroText(growth, 30) ||
      '可以开始交流和预演了',
    copy:
      truncateHeroText(growth, 60) ||
      truncateHeroText(core, 60) ||
      '下面的理解会作为后续对话的背景。',
  }
}

/**
 * 小程序侧完成度（与 src/lib/build/completeness.ts 对齐；Taro 不直接依赖父包路径）。
 */

const INSUFFICIENT_RE =
  /信息不足|不足以还原|还不够|暂时无法|需要更多|无法判断|材料不足|内容太少|无法形成|不足以判断/

export function isInsufficientSummaryText(
  mainJudgment: string,
  facts: string[] | undefined | null
): boolean {
  const judgment = (mainJudgment || '').trim()
  const factList = Array.isArray(facts) ? facts.filter((f) => String(f || '').trim()) : []
  if (!judgment) return true
  if (factList.length === 0) return true
  return INSUFFICIENT_RE.test(judgment)
}

export type ModuleCompletenessInput = {
  confirmed: boolean
  mainJudgment?: string
  facts?: string[]
  sufficient?: boolean | null
}

export function computeBuildCompletenessV2(modules: ModuleCompletenessInput[]): {
  completeness: number
  qualityValidCount: number
  confirmedCount: number
  insufficientCount: number
} {
  let qualityValidCount = 0
  let confirmedCount = 0
  let insufficientCount = 0
  let score = 0

  for (const mod of modules) {
    if (mod.confirmed) confirmedCount += 1
    if (!mod.confirmed) continue
    const insufficient =
      mod.sufficient === false ||
      (mod.sufficient !== true &&
        isInsufficientSummaryText(mod.mainJudgment || '', mod.facts))
    if (insufficient) {
      insufficientCount += 1
      continue
    }
    qualityValidCount += 1
    score += 25
  }

  let completeness = Math.min(100, score)
  if (insufficientCount > 0 && completeness >= 100) completeness = 99
  if (qualityValidCount < 4 && completeness > qualityValidCount * 25) {
    completeness = qualityValidCount * 25
  }

  return { completeness, qualityValidCount, confirmedCount, insufficientCount }
}

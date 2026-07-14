/**
 * 建档完成度（纯函数，无 server-only）。
 * V2：无效/信息不足模块不得贡献满格；四模块全确认但含不足 → 永不到 100。
 */

export function isBuildCompletenessV2Enabled(): boolean {
  const v = (process.env.BUILD_COMPLETENESS_V2 || '1').trim().toLowerCase()
  return v !== '0' && v !== 'off' && v !== 'false'
}

export function isOnboardingSummaryS3Enabled(): boolean {
  const v = (process.env.ONBOARDING_ENTRY_SUMMARY_S3 || '1').trim().toLowerCase()
  return v !== '0' && v !== 'off' && v !== 'false'
}

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
  /** 家长已点确认进入下一模块 */
  confirmed: boolean
  mainJudgment?: string
  facts?: string[]
  /** 服务端/SP 显式标记 */
  sufficient?: boolean | null
}

export type CompletenessBreakdown = {
  completeness: number
  qualityValidCount: number
  confirmedCount: number
  insufficientCount: number
}

/**
 * 单模块分数：未确认 0；确认但不足 0（不灌水）；确认且有效 25。
 * 旧路径：确认即 25（由调用方 legacy 分支处理）。
 */
export function scoreModuleV2(mod: ModuleCompletenessInput): number {
  if (!mod.confirmed) return 0
  if (mod.sufficient === false) return 0
  if (mod.sufficient === true) return 25
  if (isInsufficientSummaryText(mod.mainJudgment || '', mod.facts)) return 0
  return 25
}

export function computeBuildCompletenessV2(
  modules: ModuleCompletenessInput[]
): CompletenessBreakdown {
  let qualityValidCount = 0
  let confirmedCount = 0
  let insufficientCount = 0
  let score = 0

  for (const mod of modules) {
    if (mod.confirmed) confirmedCount += 1
    const points = scoreModuleV2(mod)
    score += points
    if (points === 25) qualityValidCount += 1
    else if (mod.confirmed) insufficientCount += 1
  }

  // 硬顶：任一确认模块质量不合格 → 永不到 100
  let completeness = Math.min(100, score)
  if (insufficientCount > 0 && completeness >= 100) {
    completeness = 99
  }
  if (qualityValidCount < 4 && completeness > qualityValidCount * 25) {
    completeness = qualityValidCount * 25
  }

  return {
    completeness,
    qualityValidCount,
    confirmedCount,
    insufficientCount,
  }
}

/** 旧路径：确认数 × 25 */
export function computeBuildCompletenessLegacy(confirmedCount: number): number {
  return Math.min(Math.max(0, confirmedCount) * 25, 100)
}

export function computeBuildCompleteness(
  modules: ModuleCompletenessInput[],
  options?: { forceLegacy?: boolean }
): CompletenessBreakdown {
  if (options?.forceLegacy || !isBuildCompletenessV2Enabled()) {
    const confirmedCount = modules.filter((m) => m.confirmed).length
    return {
      completeness: computeBuildCompletenessLegacy(confirmedCount),
      qualityValidCount: confirmedCount,
      confirmedCount,
      insufficientCount: 0,
    }
  }
  return computeBuildCompletenessV2(modules)
}

import type { RetrievedContext } from '@/types/database'

/**
 * 前端 AI（daily prose/section）只读子集键序。
 * 稳定前缀在前、动态后缀在后，与 prompt cache 对齐。
 * 契约见 docs/contracts/read-contract.md
 *
 * 双路径：FAMILY_MEMORY_THICK_PACK=0|off|false → 旧薄切（回退）；默认厚包。
 */
export const FRONTEND_READ_PACK_KEYS = [
  'childStructureModels',
  'entryEvidence',
  'entryFacts',
  'matchedMechanisms',
  'familyPatterns',
  'parentUnderstanding',
  'recentEvents',
  'pendingHypotheses',
  'childQuotes',
  'parentVerbatimSnippets',
] as const

export type FrontendReadPackKey = (typeof FRONTEND_READ_PACK_KEYS)[number]

/** 前端 AI retrievalPack 形状（全部为 string[]，禁止塞结构化对象） */
export type FrontendReadSchema = Record<FrontendReadPackKey, string[]>

/** RetrievedContext 中不得直喂前端 AI 的字段 */
export const BACKEND_ONLY_CONTEXT_FIELDS = [
  'recentDiagnosis',
] as const satisfies ReadonlyArray<keyof RetrievedContext>

/** 厚包默认开；设为 0/off/false 回退旧薄切 */
export function isThickFamilyMemoryPack(): boolean {
  const v = (process.env.FAMILY_MEMORY_THICK_PACK || '1').trim().toLowerCase()
  return v !== '0' && v !== 'off' && v !== 'false' && v !== 'thin'
}

const SLICE_LIMITS_THIN: Record<FrontendReadPackKey, number> = {
  childStructureModels: 4,
  entryEvidence: 4,
  entryFacts: 6,
  matchedMechanisms: 3,
  familyPatterns: 2,
  parentUnderstanding: 6,
  recentEvents: 5,
  pendingHypotheses: 3,
  childQuotes: 4,
  parentVerbatimSnippets: 4,
}

/** 厚包：机制人话卡可达 20；事实/原话大幅放宽（排序高价值由检索层负责） */
const SLICE_LIMITS_THICK: Record<FrontendReadPackKey, number> = {
  childStructureModels: 12,
  entryEvidence: 12,
  entryFacts: 40,
  matchedMechanisms: 20,
  familyPatterns: 10,
  parentUnderstanding: 12,
  recentEvents: 12,
  pendingHypotheses: 10,
  childQuotes: 16,
  parentVerbatimSnippets: 16,
}

export function getFrontendReadSliceLimits(): Record<FrontendReadPackKey, number> {
  return isThickFamilyMemoryPack() ? SLICE_LIMITS_THICK : SLICE_LIMITS_THIN
}

/** @deprecated 测试用：暴露当前生效上限 */
export function getActiveMatchedMechanismsLimit(): number {
  return getFrontendReadSliceLimits().matchedMechanisms
}

/** 从 RetrievedContext 抽取前端 AI 唯一可读子集 */
export function pickFrontendReadPack(ctx: RetrievedContext): FrontendReadSchema {
  const limits = getFrontendReadSliceLimits()
  return {
    childStructureModels: ctx.relevantChildStructureModel?.slice(0, limits.childStructureModels) || [],
    entryEvidence: ctx.relevantEntryEvidencePacks?.slice(0, limits.entryEvidence) || [],
    entryFacts: ctx.entryFacts?.slice(0, limits.entryFacts) || [],
    matchedMechanisms: ctx.matchedMechanisms?.slice(0, limits.matchedMechanisms) || [],
    familyPatterns: ctx.relevantFamilyInteractionPatterns?.slice(0, limits.familyPatterns) || [],
    parentUnderstanding: ctx.parentNarrativePattern?.slice(0, limits.parentUnderstanding) || [],
    recentEvents: ctx.relevantPastEvents?.slice(0, limits.recentEvents) || [],
    pendingHypotheses: ctx.relevantPendingHypotheses?.slice(0, limits.pendingHypotheses) || [],
    childQuotes: ctx.childQuotes?.slice(0, limits.childQuotes) || [],
    parentVerbatimSnippets: ctx.parentVerbatimSnippets?.slice(0, limits.parentVerbatimSnippets) || [],
  }
}

export function frontendReadPackHasContent(pack: FrontendReadSchema): boolean {
  return FRONTEND_READ_PACK_KEYS.some((k) => pack[k].length > 0)
}

/** 运行时/契约测试：pack 只含允许键且值为 string[] */
export function isFrontendReadPackShape(pack: unknown): pack is FrontendReadSchema {
  if (!pack || typeof pack !== 'object') return false
  const o = pack as Record<string, unknown>
  const keys = Object.keys(o)
  if (keys.length !== FRONTEND_READ_PACK_KEYS.length) return false
  return FRONTEND_READ_PACK_KEYS.every(
    (k) =>
      keys.includes(k) &&
      Array.isArray(o[k]) &&
      (o[k] as unknown[]).every((item) => typeof item === 'string')
  )
}

/** 契约测试：禁止后端专用字段泄漏进 retrievalPack */
export function assertNoBackendOnlyKeys(pack: Record<string, unknown>): string[] {
  const leaks: string[] = []
  for (const k of BACKEND_ONLY_CONTEXT_FIELDS) {
    if (k in pack) leaks.push(k)
  }
  for (const k of Object.keys(pack)) {
    if (!(FRONTEND_READ_PACK_KEYS as readonly string[]).includes(k)) {
      leaks.push(k)
    }
  }
  return leaks
}

import type { RetrievedContext } from '@/types/database'

/**
 * 前端 AI（daily prose/section）只读子集键序。
 * 稳定前缀在前、动态后缀在后，与 prompt cache 对齐。
 * 契约见 docs/contracts/read-contract.md
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

const SLICE_LIMITS: Record<FrontendReadPackKey, number> = {
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

/** 从 RetrievedContext 抽取前端 AI 唯一可读子集 */
export function pickFrontendReadPack(ctx: RetrievedContext): FrontendReadSchema {
  return {
    childStructureModels: ctx.relevantChildStructureModel?.slice(0, SLICE_LIMITS.childStructureModels) || [],
    entryEvidence: ctx.relevantEntryEvidencePacks?.slice(0, SLICE_LIMITS.entryEvidence) || [],
    entryFacts: ctx.entryFacts?.slice(0, SLICE_LIMITS.entryFacts) || [],
    matchedMechanisms: ctx.matchedMechanisms?.slice(0, SLICE_LIMITS.matchedMechanisms) || [],
    familyPatterns: ctx.relevantFamilyInteractionPatterns?.slice(0, SLICE_LIMITS.familyPatterns) || [],
    parentUnderstanding: ctx.parentNarrativePattern?.slice(0, SLICE_LIMITS.parentUnderstanding) || [],
    recentEvents: ctx.relevantPastEvents?.slice(0, SLICE_LIMITS.recentEvents) || [],
    pendingHypotheses: ctx.relevantPendingHypotheses?.slice(0, SLICE_LIMITS.pendingHypotheses) || [],
    childQuotes: ctx.childQuotes?.slice(0, SLICE_LIMITS.childQuotes) || [],
    parentVerbatimSnippets: ctx.parentVerbatimSnippets?.slice(0, SLICE_LIMITS.parentVerbatimSnippets) || [],
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

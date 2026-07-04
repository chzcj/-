import type { EntryType } from '@/types/storage'

/** 高保真四模块顺序：日常 → 作业 → 沟通 → 家庭 */
export const BUILD_ENTRY_ORDER = ['daily', 'homework', 'communication', 'family'] as const

export type BuildEntryType = (typeof BUILD_ENTRY_ORDER)[number]

export function isBuildEntryType(value: string): value is BuildEntryType {
  return (BUILD_ENTRY_ORDER as readonly string[]).includes(value)
}

/** 旧五入口 localStorage / 书签兼容 */
export const LEGACY_ENTRY_ROUTE: Record<string, BuildEntryType> = {
  routine: 'daily',
  study: 'homework',
  environment: 'family',
  emotion: 'communication',
}

export function normalizeBuildEntryType(value: string): BuildEntryType | null {
  if (isBuildEntryType(value)) return value
  return LEGACY_ENTRY_ROUTE[value] ?? null
}

export function getEntryProgressPercent(entryType: BuildEntryType, phase: 'input' | 'follow-up' | 'summary'): number {
  const index = BUILD_ENTRY_ORDER.indexOf(entryType)
  const base = 32 + index * 14
  if (phase === 'input') return base
  if (phase === 'follow-up') return base + 4
  return 42 + index * 14
}

export function getNextBuildEntry(entryType: BuildEntryType): BuildEntryType | 'final-follow-up' | null {
  const index = BUILD_ENTRY_ORDER.indexOf(entryType)
  if (index < 0) return null
  if (index < BUILD_ENTRY_ORDER.length - 1) return BUILD_ENTRY_ORDER[index + 1]
  return 'final-follow-up'
}

export function buildEntryPath(entryType: BuildEntryType, sub?: 'follow-up' | 'summary'): string {
  if (!sub) return `/profile/build/${entryType}`
  return `/profile/build/${entryType}/${sub}`
}

export function firstBuildEntryPath(): string {
  return buildEntryPath(BUILD_ENTRY_ORDER[0])
}

/** 非四模块的 EntryType（如 final）不参与 BUILD_ENTRY_ORDER */
export function asEntryType(t: BuildEntryType): EntryType {
  return t
}

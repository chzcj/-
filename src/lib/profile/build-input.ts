import { computeBuildCompletenessV2, type ModuleCompletenessInput } from '@/lib/build/completeness'

export const BUILD_MODULE_KEYS = ['daily', 'homework', 'communication', 'family'] as const
export type BuildModuleKey = (typeof BUILD_MODULE_KEYS)[number]

export type ProfileBuildEntryModule = {
  rawTexts: string[]
  followUps: string[]
  stageSummary?: string
  aiFacts?: string[]
  aiHypotheses?: string[]
  moduleComplete?: boolean
  summarySufficient?: boolean
}

export type ProfileBuildInputSnapshot = {
  inputVersion: string
  finalFollowUpText: string
  entryMap: Record<string, ProfileBuildEntryModule>
  createdAt: string
}

export function computeProfileInputVersion(input: {
  finalFollowUpText?: string
  entryMap: Record<string, ProfileBuildEntryModule>
}): string {
  const parts = [
    input.finalFollowUpText || '',
    ...BUILD_MODULE_KEYS.flatMap((key) => {
      const value = input.entryMap[key]
      return [
        ...(value?.rawTexts || []),
        ...(value?.followUps || []),
        value?.stageSummary || '',
      ]
    }),
  ].join('\u0001')
  let hash = 0
  for (let i = 0; i < parts.length; i++) hash = (hash * 31 + parts.charCodeAt(i)) | 0
  return `${Math.abs(hash)}-${parts.length}`
}

export function buildCompletenessFromEntryMap(entryMap: Record<string, ProfileBuildEntryModule>) {
  const modules: ModuleCompletenessInput[] = BUILD_MODULE_KEYS.map((key) => {
    const mod = entryMap[key]
    return {
      confirmed: Boolean(mod?.moduleComplete),
      mainJudgment: mod?.stageSummary || '',
      facts: mod?.aiFacts || [],
      sufficient: mod?.summarySufficient,
    }
  })
  return computeBuildCompletenessV2(modules)
}

export function resolveMaturityLevel(entryMap: Record<string, ProfileBuildEntryModule>): 'L0' | 'L1' | 'L2' {
  const { qualityValidCount } = buildCompletenessFromEntryMap(entryMap)
  const completed = BUILD_MODULE_KEYS.filter((key) => Boolean(entryMap[key]?.moduleComplete)).length
  if (qualityValidCount >= 4) return 'L2'
  if (qualityValidCount >= 2) return 'L1'
  return completed >= 1 ? 'L0' : 'L0'
}

export function completedModuleCount(entryMap: Record<string, ProfileBuildEntryModule>): number {
  return BUILD_MODULE_KEYS.filter((key) => Boolean(entryMap[key]?.moduleComplete)).length
}

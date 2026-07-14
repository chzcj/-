import type { CandidateMechanism } from '@/types/database'
import type { DeepModelDigest, StructuralTension } from '@/types/deep-model-digest'
import { EMPTY_DEEP_MODEL_DIGEST } from '@/types/deep-model-digest'
import { isThickFamilyMemoryPack } from '@/lib/server/daily/frontend-read-pack'

/** 供前台 Agent user payload 注入的 digest 形状（全 string / string[]，禁止结构化对象泄漏）。 */
export type DeepModelDigestPack = {
  mechanismNarrative: string
  interactionLoops: string[]
  anchoredFacts: string[]
  parentVerbatimSnippets: string[]
  childQuotes: string[]
  parentInteractionStyle: string
  preferredPacing: string
  openHypotheses: string[]
  cultivationFocus: string
  /** 结构张力人话条（厚包必带；薄包可空） */
  structuralTensions: string[]
}

const SLICE_THIN = {
  interactionLoops: 4,
  anchoredFacts: 8,
  parentVerbatimSnippets: 5,
  childQuotes: 4,
  openHypotheses: 5,
  structuralTensions: 0,
} as const

const SLICE_THICK = {
  interactionLoops: 12,
  anchoredFacts: 24,
  parentVerbatimSnippets: 16,
  childQuotes: 16,
  openHypotheses: 12,
  structuralTensions: 8,
} as const

export type DeepModelDigestSlices = typeof SLICE_THIN | typeof SLICE_THICK

/** digest 构建 / LLM 后处理 / 前台 pick 共用的 thick-thin 切片上限。 */
export function getDeepModelDigestSlices(): DeepModelDigestSlices {
  return isThickFamilyMemoryPack() ? SLICE_THICK : SLICE_THIN
}

function tensionLine(t: StructuralTension): string {
  const title = (t.title || '').trim()
  const detail = (t.detail || '').trim()
  if (title && detail) return `${title}：${detail}`
  return title || detail
}

export function pickDeepModelDigestPack(digest: DeepModelDigest | null | undefined): DeepModelDigestPack {
  const d = digest ?? EMPTY_DEEP_MODEL_DIGEST
  const slice = getDeepModelDigestSlices()
  const tensions = (d.structuralTensions || [])
    .map(tensionLine)
    .filter(Boolean)
    .slice(0, slice.structuralTensions)

  return {
    mechanismNarrative: d.mechanismNarrative?.trim() || '',
    interactionLoops: (d.interactionLoops || []).slice(0, slice.interactionLoops),
    anchoredFacts: (d.anchoredFacts || []).slice(0, slice.anchoredFacts),
    parentVerbatimSnippets: (d.parentVerbatimSnippets || []).slice(0, slice.parentVerbatimSnippets),
    childQuotes: (d.childQuotes || []).slice(0, slice.childQuotes),
    parentInteractionStyle: d.parentInteractionStyle?.trim() || '',
    preferredPacing: d.preferredPacing?.trim() || '',
    openHypotheses: (d.openHypotheses || []).slice(0, slice.openHypotheses),
    cultivationFocus: d.cultivationFocus?.trim() || '',
    structuralTensions: tensions,
  }
}

export function deepModelDigestHasContent(pack: DeepModelDigestPack): boolean {
  return Boolean(
    pack.mechanismNarrative ||
      pack.anchoredFacts.length > 0 ||
      pack.interactionLoops.length > 0 ||
      pack.openHypotheses.length > 0 ||
      pack.structuralTensions.length > 0
  )
}

/**
 * 将机制矩阵格式化为家长向人话卡（仍是 string，供 matchedMechanisms）。
 * 厚包：名+描述+依据+保护功能；薄包：仅机制名。
 * 禁止输出理论卡 ID；描述里若仅有空标签则退回短名。
 */
export function formatMatchedMechanismCards(
  matrix: CandidateMechanism[] | null | undefined
): string[] {
  const list = (matrix || []).filter((m) => m.overallStrength !== 'low' && m.mechanismName?.trim())
  const thick = isThickFamilyMemoryPack()
  const limit = thick ? 20 : 3

  return list.slice(0, limit).map((m) => {
    const name = m.mechanismName.trim()
    if (!thick) return name

    const desc = (m.description || '').trim()
    const evidence = (m.supportingEvidence || []).filter(Boolean).slice(0, 2)
    const protect = (m.possibleProtectiveFunction || '').trim()
    const parts = [name]
    if (desc && desc !== name) parts.push(desc)
    if (evidence.length) parts.push(`依据：${evidence.join('；')}`)
    if (protect) parts.push(`可能在保护：${protect}`)
    return parts.join('。')
  })
}

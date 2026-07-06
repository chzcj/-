/** 家长向深度建模摘要（SecondMe digest），供前台 Agent 与画像页读取。 */
export type StructuralTension = {
  title: string
  detail: string
  confidence?: 'low' | 'medium' | 'high'
}

export type DeepModelDigest = {
  mechanismNarrative: string
  interactionLoops: string[]
  anchoredFacts: string[]
  parentVerbatimSnippets: string[]
  childQuotes: string[]
  parentInteractionStyle?: string
  preferredPacing?: string
  openHypotheses: string[]
  cultivationFocus: string
  structuralTensions: StructuralTension[]
  updatedAt: string
  source: 'llm' | 'deterministic'
}

export const EMPTY_DEEP_MODEL_DIGEST: DeepModelDigest = {
  mechanismNarrative: '',
  interactionLoops: [],
  anchoredFacts: [],
  parentVerbatimSnippets: [],
  childQuotes: [],
  openHypotheses: [],
  cultivationFocus: '',
  structuralTensions: [],
  updatedAt: '',
  source: 'deterministic',
}

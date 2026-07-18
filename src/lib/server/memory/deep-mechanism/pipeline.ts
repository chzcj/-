import 'server-only'

import { createHash } from 'node:crypto'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { callAgentJson } from '@/lib/server/ark-agents'
import {
  getEntryEvidencePacks,
  getMergedParentInputHistory,
  getLatestEvidenceNetwork,
  getPendingHypotheses,
  getLatestBuiltProfileSnapshot,
  saveBuiltProfileSnapshot,
  getFamilyInteractionCycles,
  saveFamilyInteractionCycles,
  getParentNarrativePattern,
  saveEvidenceNetwork,
  savePendingHypotheses,
  saveParentNarrativePattern,
} from '@/lib/server/memory/database-manager'
import { getCurrentMaturityState } from '@/lib/server/context/maturity'
import { createId } from '@/lib/storage/storageIds'
import type { TenantId } from '@/lib/server/memory/tenant'
import type {
  CandidateMechanism,
  CrossEntryEvidenceNetwork,
  EcosystemLayer,
  EntryEvidencePack,
  EntryName,
  EvidenceStrength,
  FamilyInteractionChain,
  FamilyInteractionCycle,
  HypothesisWeight,
  MechanismType,
  ParentNarrativePattern,
  PendingHypothesis,
} from '@/types/database'
import type { StructuralTension } from '@/types/deep-model-digest'
import { THEORY_CARDS } from '@/lib/server/memory/deep-mechanism/theory-cards'
import {
  loadDeepMechanismHandoff,
  saveDeepMechanismHandoff,
  type ClassifiedFact,
  type TheoryMatchHandoff,
} from '@/lib/server/memory/deep-mechanism/handoff-store'

const ENTRY_NAMES: EntryName[] = [
  'learning_homework',
  'daily_rhythm_phone',
  'parent_child_communication',
  'emotional_stress',
  'relationship_environment',
]

// 深度机制链一次 Job 可能顺序执行 4–5 个长 JSON 调用。不能让它们共用
// 前台默认的 45 秒边界，否则任一步超时都会让队列从步骤 1 整链重跑。
const DEEP_STEP_TIMEOUT_MS = 90_000
const DEEP_JSON_PARSE_RETRIES = 1

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) : []

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback)

function normStrength(v: unknown): EvidenceStrength {
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'medium'
}

function normWeight(v: unknown): HypothesisWeight {
  const allowed: HypothesisWeight[] = ['very_low', 'low', 'medium', 'medium_high', 'high']
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as HypothesisWeight) : 'low'
}

function normReceptivity(v: unknown): 'high' | 'medium' | 'low' {
  if (v === 'high' || v === 'medium' || v === 'low') return v
  // Prompt 侧可用 open|resistant|mixed|unknown，入库统一为 high|medium|low
  if (v === 'open') return 'high'
  if (v === 'resistant') return 'low'
  if (v === 'mixed' || v === 'unknown') return 'medium'
  return 'medium'
}

function strengthToType(s: EvidenceStrength): MechanismType {
  if (s === 'high') return 'core_candidate'
  if (s === 'medium') return 'stage_candidate'
  return 'local_candidate'
}

function normChain(v: unknown): FamilyInteractionChain {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    return {
      parentTriggerAction: str(o.parentTriggerAction),
      parentReasonableGoal: str(o.parentReasonableGoal, '帮助孩子'),
      childReception: str(o.childReception),
      childReaction: str(o.childReaction),
      parentSecondInterpretation: str(o.parentSecondInterpretation),
      parentReinforcementAction: str(o.parentReinforcementAction),
      childFurtherStrategy: str(o.childFurtherStrategy),
      longTermEffect: str(o.longTermEffect),
    }
  }
  const text = str(v)
  const parts = text.split(/[→>]/).map((p) => p.trim()).filter(Boolean)
  return {
    parentTriggerAction: parts[0] || '',
    parentReasonableGoal: '帮助孩子',
    childReception: parts[1] || '',
    childReaction: parts[2] || '',
    parentSecondInterpretation: parts[3] || '',
    parentReinforcementAction: parts[4] || '',
    childFurtherStrategy: parts[5] || '',
    longTermEffect: parts[6] || '',
  }
}

function normScores(v: unknown): CandidateMechanism['scores'] {
  const map = (x: unknown) => (x === 'high' ? 0.9 : x === 'medium' ? 0.6 : x === 'low' ? 0.3 : 0.5)
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    const ep = map(o.explanatoryPower)
    const cc = map(o.crossSceneConsistency)
    const es = map(o.evidenceSupport)
    const avg = (ep + cc + es) / 3
    return {
      evidenceSpecificity: es,
      crossEntryRepetition: cc,
      explanatoryCoverage: ep,
      familyChainCompleteness: avg,
      protectiveFunctionClarity: avg,
      counterInfoCompatibility: avg,
      verifiability: avg,
      familySpecificity: avg,
    }
  }
  const fill = 0.5
  return {
    evidenceSpecificity: fill,
    crossEntryRepetition: fill,
    explanatoryCoverage: fill,
    familyChainCompleteness: fill,
    protectiveFunctionClarity: fill,
    counterInfoCompatibility: fill,
    verifiability: fill,
    familySpecificity: fill,
  }
}

function normEcosystemLayer(v: unknown): EcosystemLayer | undefined {
  const s = str(v).toLowerCase()
  if (s === 'micro' || s === '微系统') return 'micro'
  if (s === 'meso' || s === '中间系统') return 'meso'
  if (s === 'exo' || s === '外系统') return 'exo'
  if (s === 'macro' || s === '宏系统') return 'macro'
  if (s === 'chrono' || s === '时间系统') return 'chrono'
  return undefined
}

interface RawMechanism {
  mechanismName?: string
  mechanismType?: string
  ecosystemLayer?: string
  theoryCardId?: string
  description?: string
  supportedByEntries?: unknown
  supportingEvidence?: unknown
  explainedBehaviors?: unknown
  possibleProtectiveFunction?: string
  familyInteractionChain?: unknown
  scores?: unknown
  overallStrength?: string
  applicableScope?: string
  missingEvidence?: unknown
  possibleAlternativeExplanations?: unknown
  shouldPromoteToDiagnosis?: boolean
}

interface RawHypothesis {
  hypothesis?: string
  supportingEvidence?: unknown
  missingEvidence?: unknown
  verificationQuestions?: unknown
  weight?: string
  applicableScenes?: unknown
}

interface RawPattern {
  observations?: unknown
  interactionImplications?: unknown
  correctionReceptivity?: string
  factProvisionAbility?: string
}

interface MechanismSynthesizeOutput {
  candidateMechanismMatrix?: RawMechanism[]
  pendingHypotheses?: RawHypothesis[]
  parentNarrativePattern?: RawPattern
}

function normEntryNames(v: unknown): EntryName[] {
  const got = arr(v)
  return got.filter((x): x is EntryName => (ENTRY_NAMES as string[]).includes(x)) as EntryName[]
}

function normMechanism(m: RawMechanism): CandidateMechanism {
  const strength = normStrength(m.overallStrength)
  return {
    mechanismName: str(m.mechanismName, '未命名机制'),
    mechanismType: strengthToType(strength),
    description: str(m.description),
    supportedByEntries: normEntryNames(m.supportedByEntries),
    supportingEvidence: arr(m.supportingEvidence),
    explainedBehaviors: arr(m.explainedBehaviors),
    possibleProtectiveFunction: str(m.possibleProtectiveFunction),
    familyInteractionChain: normChain(m.familyInteractionChain),
    scores: normScores(m.scores),
    overallStrength: strength,
    applicableScope: str(m.applicableScope),
    missingEvidence: arr(m.missingEvidence),
    possibleAlternativeExplanations: arr(m.possibleAlternativeExplanations),
    shouldPromoteToDiagnosis: m.shouldPromoteToDiagnosis === true,
    ecosystemLayer: normEcosystemLayer(m.ecosystemLayer),
    theoryCardId: str(m.theoryCardId) || undefined,
  }
}

function flattenFactsFromPacks(packs: EntryEvidencePack[]): Array<{ factId: string; text: string; entryName: string }> {
  const out: Array<{ factId: string; text: string; entryName: string }> = []
  let idx = 0
  for (const p of packs) {
    const d = p.decomposedInput
    const buckets = [
      ...(d.verifiableFacts || []),
      ...(d.childBehaviors || []),
      ...(d.triggerPoints || []),
      ...(d.parentActions || []),
      ...(d.parentEvaluations || []),
    ]
    for (const text of buckets) {
      if (!text?.trim()) continue
      idx += 1
      out.push({ factId: `f${idx}`, text: text.trim().slice(0, 240), entryName: p.entryName })
    }
  }
  return out.slice(0, 80)
}

function buildRichPackDigest(packs: EntryEvidencePack[]) {
  return packs.map((p) => ({
    entryName: p.entryName,
    verifiableFacts: (p.decomposedInput.verifiableFacts || []).slice(0, 12),
    childBehaviors: (p.decomposedInput.childBehaviors || []).slice(0, 12),
    triggerPoints: (p.decomposedInput.triggerPoints || []).slice(0, 8),
    parentActions: (p.decomposedInput.parentActions || []).slice(0, 8),
    parentGoals: (p.decomposedInput.parentGoals || []).slice(0, 6),
    parentEvaluations: (p.decomposedInput.parentEvaluations || []).slice(0, 6),
    childQuotes: (p.decomposedInput as { childQuotes?: string[] }).childQuotes?.slice(0, 6) || [],
    parentQuotes: (p.decomposedInput as { parentQuotes?: string[] }).parentQuotes?.slice(0, 6) || [],
  }))
}

function normStructuralTensions(raw: unknown): StructuralTension[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const title = str(o.title)
      const detail = str(o.detail)
      if (!title || !detail) return null
      const conf = str(o.confidence)
      const confidence =
        conf === 'high' || conf === 'medium' || conf === 'low' ? conf : undefined
      return { title, detail, confidence } as StructuralTension
    })
    .filter((x): x is StructuralTension => Boolean(x))
    .slice(0, 5)
}

function isJsonParseFailure(error: unknown): boolean {
  return error instanceof Error && error.message === 'FAST_AI_JSON_PARSE_FAILED'
}

/** 只给深度机制链的长 JSON 调用放宽超时；截断时局部重试一次，避免整 Job 从头重跑。 */
async function callDeepAgentJson<T>(
  agent: Parameters<typeof callAgentJson>[0],
  task: string,
  payload: unknown,
  maxTokens: number
): Promise<T | undefined> {
  for (let attempt = 0; attempt <= DEEP_JSON_PARSE_RETRIES; attempt += 1) {
    try {
      return await callAgentJson<T>(agent, task, payload, {
        maxTokens,
        timeoutMs: DEEP_STEP_TIMEOUT_MS,
      })
    } catch (error) {
      if (!isJsonParseFailure(error) || attempt === DEEP_JSON_PARSE_RETRIES) throw error
      console.warn(
        `[deep-mechanism] ${agent} JSON 截断，第 ${attempt + 1} 次局部重试`,
      )
    }
  }
  return undefined
}

async function runLegacyMonolith(payload: Record<string, unknown>): Promise<MechanismSynthesizeOutput | undefined> {
  return callDeepAgentJson<MechanismSynthesizeOutput>(
    'deepMechanismReview',
    '用五大生态系统+20家庭理论框架，产出回归家庭结构根因的深度机制（覆盖旧机制层；目标多域10–20条）。',
    payload,
    // 多域机制矩阵、假设与亲子链输出较长，给后台理论抽象足够空间。
    12288,
  )
}

export async function runDeepMechanismReview(tenant: TenantId): Promise<boolean> {
  const maturity = getCurrentMaturityState(tenant)

  const [
    packs,
    inputHistory,
    existingNetwork,
    hypotheses,
    builtSnapshot,
    cycles,
    existingPattern,
  ] = await Promise.all([
    getEntryEvidencePacks(tenant),
    getMergedParentInputHistory(tenant, 100),
    getLatestEvidenceNetwork(tenant),
    getPendingHypotheses(tenant),
    getLatestBuiltProfileSnapshot(tenant),
    getFamilyInteractionCycles(tenant),
    getParentNarrativePattern(tenant),
  ])

  const flatFacts = flattenFactsFromPacks(packs)
  const totalFacts = flatFacts.length + inputHistory.length
  if (totalFacts < 3) return false
  const sourceFingerprint = createHash('sha256')
    // 日常 Episode/turn 也是深度机制输入；仅对四模块事实做指纹会让新 daily 证据
    // 复用过期 checkpoint，表现为后台“没有重新理解”。
    .update(JSON.stringify({
      facts: flatFacts.map((fact) => [fact.factId, fact.text, fact.entryName]),
      recentInputs: inputHistory.slice(-100).map((item) => [item.traceId || '', item.timestamp || '', item.text]),
    }))
    .digest('hex')
  const checkpoint = await loadDeepMechanismHandoff(tenant)
  const canResume = checkpoint?.sourceFingerprint === sourceFingerprint

  const packDigest = buildRichPackDigest(packs)
  const recentInputs = inputHistory.slice(-30).map((h) => h.text).filter(Boolean)
  const sharedContext = {
    entryPacks: packDigest,
    flatFacts,
    dailyUpdates: recentInputs,
    // S6+大胆握手：把已有机制的描述/功能交给下游，避免只剩空壳名
    existingMechanisms:
      existingNetwork?.candidateMechanismMatrix?.slice(0, 20).map((m) => ({
        mechanismName: m.mechanismName,
        ecosystemLayer: m.ecosystemLayer,
        overallStrength: m.overallStrength,
        description: (m.description || '').slice(0, 180),
        theoryCardId: m.theoryCardId,
        possibleProtectiveFunction: m.possibleProtectiveFunction,
      })) || [],
    existingHypotheses: hypotheses.slice(0, 16).map((h) => ({
      hypothesis: h.hypothesis,
      status: h.status,
      supportingEvidence: (h.supportingEvidence || []).slice(0, 2),
    })),
    familyInteractionCycles: cycles.slice(0, 12).map((c) => ({
      cycleName: c.cycleName,
      parentTriggerAction: c.parentTriggerAction,
      childReception: c.childReception,
      childReaction: c.childReaction,
      parentSecondInterpretation: c.parentSecondInterpretation,
    })),
    builtCoreJudgment: builtSnapshot?.coreJudgment || '',
    builtDeepMechanism: builtSnapshot?.deepMechanism || '',
    existingParentNarrative: existingPattern
      ? {
          observations: existingPattern.observations,
          interactionImplications: existingPattern.interactionImplications,
          correctionReceptivity: existingPattern.correctionReceptivity,
          factProvisionAbility: existingPattern.factProvisionAbility,
        }
      : null,
  }

  let ecosystemMap: ClassifiedFact[] = canResume && checkpoint?.ecosystemMap.length
    ? checkpoint.ecosystemMap
    : []
  let classifyRaw: { classifiedFacts?: ClassifiedFact[] } | undefined
  if (!ecosystemMap.length) {
    try {
      classifyRaw = await callDeepAgentJson<{ classifiedFacts?: ClassifiedFact[] }>(
        'ecosystemClassifier',
        '对每条家庭事实做五大生态系统分类。',
        { facts: flatFacts },
        // 全量事实逐条分类输出很长，避免后台事实加工被输出上限截断。
        8192,
      )
    } catch (error) {
      console.warn('[deep-mechanism] 生态分类失败，回退 micro 层:', error)
    }
    if (classifyRaw?.classifiedFacts?.length) {
      ecosystemMap = classifyRaw.classifiedFacts
        .filter((f) => str(f.text))
        .map((f) => ({
          factId: str(f.factId, `f${Math.random()}`),
          text: str(f.text),
          entryName: str(f.entryName),
          layers: (Array.isArray(f.layers) ? f.layers : [])
            .map((l) => normEcosystemLayer(l))
            .filter((l): l is EcosystemLayer => Boolean(l)),
        }))
    }
  } else {
    console.info('[deep-mechanism] 复用分类检查点')
  }
  if (!ecosystemMap.length) {
    ecosystemMap = flatFacts.map((f) => ({
      ...f,
      layers: ['micro' as EcosystemLayer],
    }))
  }
  await saveDeepMechanismHandoff(
    {
      ecosystemMap,
      theoryMatches: canResume ? checkpoint?.theoryMatches || [] : [],
      structuralTensions: [],
      sourceFingerprint,
      stage: 'classified',
      updatedAt: new Date().toISOString(),
    },
    tenant
  )

  let theoryMatches: TheoryMatchHandoff[] = canResume && checkpoint?.stage === 'theory_matched'
    ? checkpoint.theoryMatches
    : []
  let matchRaw: { theoryMatches?: TheoryMatchHandoff[] } | undefined
  if (!theoryMatches.length) {
    try {
      matchRaw = await callDeepAgentJson<{ theoryMatches?: TheoryMatchHandoff[] }>(
        'theoryMatcher',
        '基于生态系统分类匹配理论卡。',
        { ecosystemMap, theoryCards: THEORY_CARDS },
        8192,
      )
    } catch (error) {
      console.warn('[deep-mechanism] 理论匹配失败，继续使用空匹配:', error)
    }
    if (matchRaw?.theoryMatches?.length) {
      theoryMatches = matchRaw.theoryMatches
        .filter((m) => str(m.theoryCardId))
        .map((m) => ({
          theoryCardId: str(m.theoryCardId),
          theoryName: str(m.theoryName),
          ecosystemLayer: normEcosystemLayer(m.ecosystemLayer) || 'micro',
          confidence: normStrength(m.confidence) as 'low' | 'medium' | 'high',
          matchedFactIds: arr(m.matchedFactIds),
          rationale: str(m.rationale),
        }))
    }
  } else {
    console.info('[deep-mechanism] 复用理论匹配检查点')
  }
  await saveDeepMechanismHandoff(
    {
      ecosystemMap,
      theoryMatches,
      structuralTensions: [],
      sourceFingerprint,
      stage: 'theory_matched',
      updatedAt: new Date().toISOString(),
    },
    tenant
  )

  let ai: MechanismSynthesizeOutput | undefined
  try {
    ai = await callDeepAgentJson<MechanismSynthesizeOutput>(
      'mechanismSynthesizer',
      '综合理论匹配与全量证据，产出多域深度机制矩阵（目标10–20条）。',
      { ...sharedContext, ecosystemMap, theoryMatches },
      // 多域矩阵、家庭链与理论解释体量大，保留充分输出预算。
      12288,
    )
  } catch (error) {
    console.warn('[deep-mechanism] 多域综合失败，尝试 legacy 回退:', error)
  }

  if (!ai?.candidateMechanismMatrix?.length) {
    ai = await runLegacyMonolith({ ...sharedContext, ecosystemMap, theoryMatches })
  }

  if (!ai?.candidateMechanismMatrix?.length) return false

  let riskRaw: { structuralTensions?: StructuralTension[] } | undefined
  try {
    riskRaw = await callDeepAgentJson<{ structuralTensions?: StructuralTension[] }>(
      'structuralRiskExtractor',
      '提取家庭结构潜在不利因素（家长可读张力）。',
      {
        entryPacks: packDigest,
        candidateMechanismMatrix: ai.candidateMechanismMatrix,
        builtCoreJudgment: builtSnapshot?.coreJudgment || '',
      },
      6144,
    )
  } catch (error) {
    // 张力是展示增强项，不应阻止已完成的机制矩阵与假设写回。
    console.warn('[deep-mechanism] 结构张力提取失败，继续落库主矩阵:', error)
  }
  const structuralTensions = normStructuralTensions(riskRaw?.structuralTensions)

  const now = new Date().toISOString()

  await saveDeepMechanismHandoff(
    {
      ecosystemMap,
      theoryMatches,
      structuralTensions,
      sourceFingerprint,
      stage: 'completed',
      updatedAt: now,
    },
    tenant
  )

  const coverage: Record<EntryName, 'missing' | 'partial' | 'sufficient' | 'strong'> = {
    learning_homework: 'missing',
    daily_rhythm_phone: 'missing',
    parent_child_communication: 'missing',
    emotional_stress: 'missing',
    relationship_environment: 'missing',
  }
  for (const p of packs) coverage[p.entryName] = 'sufficient'

  const network: CrossEntryEvidenceNetwork = {
    networkId: existingNetwork?.networkId || createId('net'),
    familyId: tenant.familyId,
    childId: tenant.childId,
    maturityLevel: maturity.level,
    inputCoverage: coverage,
    crossEntryEvidenceMap: existingNetwork?.crossEntryEvidenceMap || [],
    candidateMechanismMatrix: ai.candidateMechanismMatrix.map((m) => normMechanism(m)),
    mechanismLayerSource: 'deep_mechanism',
    createdAt: existingNetwork?.createdAt || now,
    updatedAt: now,
  }
  await saveEvidenceNetwork(network, tenant)

  // familyPatterns 是前台厚包的独立消费字段。深度机制已经产出完整亲子链时，
  // 把链显式固化为 cycle；无完整链不写，避免空 Agent 结果覆盖已有有效模式。
  const refreshedCycles: FamilyInteractionCycle[] = network.candidateMechanismMatrix
    .filter((m) => m.overallStrength !== 'low')
    .map<FamilyInteractionCycle | null>((m) => {
      const chain = m.familyInteractionChain
      const hasChain = [chain.parentTriggerAction, chain.childReaction, chain.longTermEffect].some(Boolean)
      if (!hasChain) return null
      const previous = cycles.find((cycle) => cycle.cycleName === m.mechanismName)
      return {
        cycleId: previous?.cycleId || createId('cycle'),
        familyId: tenant.familyId,
        childId: tenant.childId,
        cycleName: m.mechanismName,
        parentTriggerAction: chain.parentTriggerAction,
        parentReasonableGoal: chain.parentReasonableGoal,
        childReception: chain.childReception,
        childReaction: chain.childReaction,
        parentSecondInterpretation: chain.parentSecondInterpretation,
        parentReinforcementAction: chain.parentReinforcementAction,
        childFurtherStrategy: chain.childFurtherStrategy,
        longTermEffect: chain.longTermEffect,
        supportingEvidence: m.supportingEvidence.slice(0, 12),
        sceneScope: m.applicableScope,
        status: m.overallStrength === 'high' ? 'stable' : 'stage',
        version: (previous?.version || 0) + 1,
        previousVersionId: previous?.cycleId,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      }
    })
    .filter((cycle): cycle is FamilyInteractionCycle => Boolean(cycle))
    .slice(0, 20)
  if (refreshedCycles.length > 0) {
    await saveFamilyInteractionCycles(refreshedCycles, tenant)
  }

  const newHypotheses: PendingHypothesis[] = (ai.pendingHypotheses || [])
    .filter((h) => str(h.hypothesis))
    .map((h) => ({
      hypothesisId: createId('hyp'),
      familyId: tenant.familyId,
      childId: tenant.childId,
      hypothesis: str(h.hypothesis),
      triggerSource: 'deep_mechanism_review',
      supportingEvidence: arr(h.supportingEvidence),
      missingEvidence: arr(h.missingEvidence),
      verificationQuestions: arr(h.verificationQuestions),
      possibleCounterEvidence: [],
      weight: normWeight(h.weight),
      applicableScenes: arr(h.applicableScenes),
      status: 'pending' as const,
      retrievalTags: [],
      createdAt: now,
      updatedAt: now,
    }))
  if (newHypotheses.length > 0) {
    const merged = [...hypotheses.filter((h) => h.status !== 'pending'), ...newHypotheses]
    await savePendingHypotheses(merged, tenant)
  }

  const rawPattern = ai.parentNarrativePattern
  const patternObservations = arr(rawPattern?.observations)
  const patternImplications = arr(rawPattern?.interactionImplications)
  if (rawPattern && (patternObservations.length > 0 || patternImplications.length > 0)) {
    const pattern: ParentNarrativePattern = {
      patternId: createId('pnp'),
      familyId: tenant.familyId,
      childId: tenant.childId,
      observations: patternObservations.slice(0, 16),
      labelTendency: 'occasional',
      moralizeTendency: 'occasional',
      effortEmphasis: 'occasional',
      selfBlameTendency: 'occasional',
      correctionReceptivity: normReceptivity(rawPattern.correctionReceptivity),
      factProvisionAbility: normReceptivity(rawPattern.factProvisionAbility),
      interactionImplications: patternImplications.slice(0, 12),
      createdAt: now,
      updatedAt: now,
    }
    await saveParentNarrativePattern(pattern, tenant)
  }

  if (builtSnapshot) {
    const tops = network.candidateMechanismMatrix
      .filter((m) => m.overallStrength !== 'low')
      .slice(0, 3)
    const newDeepMechanism = tops.length
      ? tops
          .map((m, i) => `${i === 0 ? '主' : '次'}${i + 1} ${m.mechanismName}：${(m.description || '').slice(0, 80)}`)
          .join('｜')
          .slice(0, 600)
      : builtSnapshot.deepMechanism
    if (newDeepMechanism && newDeepMechanism !== builtSnapshot.deepMechanism) {
      await saveBuiltProfileSnapshot(
        { ...builtSnapshot, deepMechanism: newDeepMechanism, updatedAt: now },
        tenant
      )
    }
  }

  await buildDeepModelDigest(tenant, structuralTensions).catch((err) => {
    console.error('[deep-mechanism] digest 构建失败:', err)
  })
  return true
}

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
  PARENT_INPUT_WINDOW,
  sliceParentInputTexts,
} from '@/lib/server/memory/database-manager'
import { getCurrentMaturityState } from '@/lib/server/context/maturity'
import { createId } from '@/lib/storage/storageIds'
import type { TenantId } from '@/lib/server/memory/tenant'
import {
  loadFamilyAgentPersona,
  saveFamilyAgentPersona,
  buildDefaultPersona,
} from '@/lib/server/memory/family-agent-persona/persona-store'
import type { FamilyAgentPersona } from '@/types/database'
import type {
  CandidateMechanism,
  CrossEntryEvidenceNetwork,
  EcosystemLayer,
  EntryEvidencePack,
  EntryName,
  EvidenceRef,
  EvidenceStrength,
  FamilyInteractionChain,
  FamilyInteractionCycle,
  HypothesisWeight,
  MechanismEdge,
  MechanismSceneActivation,
  MechanismType,
  ParentNarrativePattern,
  PendingHypothesis,
} from '@/types/database'
import type { StructuralTension } from '@/types/deep-model-digest'
import { THEORY_CARDS, theoryCardsSystemAppendix } from '@/lib/server/memory/deep-mechanism/theory-cards'
import {
  gateDossier,
  gateMechanismMatrix,
  hasRetryableViolations,
  formatViolationsForRetry,
} from '@/lib/server/harness/background-post-gate'
import { isPortraitV3Enabled } from '@/lib/server/memory/dossier/portrait-v3-flags'
import { shouldReconceptualize } from '@/lib/server/memory/dossier/should-reconceptualize'
import { getFailedPredictions } from '@/lib/server/memory/dossier/prediction-failure'
import { getLatestDossier, saveDossierVersion } from '@/lib/server/memory/deep-modeling/digest-store'
import type { FamilyUnderstandingDossier } from '@/types/family-understanding-dossier'
import {
  loadDeepMechanismHandoff,
  saveDeepMechanismHandoff,
  type ClassifiedFact,
  type TheoryMatchHandoff,
} from '@/lib/server/memory/deep-mechanism/handoff-store'
import { linkAtomsToMechanisms } from '@/lib/server/memory/deep-mechanism/atom-mechanism-links'

/** post-gate 用：合法理论卡 ID 集（防 LLM 伪造卡 ID 污染下游） */
const VALID_THEORY_CARD_IDS: ReadonlySet<string> = new Set(THEORY_CARDS.map((c) => c.id))

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
  /** v4.1：场景×角色激活 */
  sceneActivations?: unknown
  /** v4.1：机制间关系（SP 以 target 机制名引用） */
  relatedMechanisms?: unknown
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

interface PortraitSynthesizeOutput {
  dossier?: FamilyUnderstandingDossier
  pendingHypotheses?: RawHypothesis[]
  parentNarrativePattern?: RawPattern
  candidateMechanismMatrix?: RawMechanism[]
}

function normEntryNames(v: unknown): EntryName[] {
  const got = arr(v)
  return got.filter((x): x is EntryName => (ENTRY_NAMES as string[]).includes(x)) as EntryName[]
}

const VALID_EDGE_RELATIONS = new Set(['competesWith', 'reinforces', 'upstreamOf', 'explainsSameBehavior', 'contradicts'])

/** v4.1：解析场景×角色激活（strength 钳制 0-1，无 scene 丢弃） */
function normSceneActivations(v: unknown): MechanismSceneActivation[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v
    .map((item): MechanismSceneActivation | null => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const scene = str(o.scene)
      if (!scene) return null
      const strength = typeof o.strength === 'number' && Number.isFinite(o.strength)
        ? Math.max(0, Math.min(1, o.strength))
        : undefined
      return {
        scene,
        presentRoles: arr(o.presentRoles).slice(0, 4),
        strength,
        note: str(o.note) || undefined,
      }
    })
    .filter((x): x is MechanismSceneActivation => Boolean(x))
    .slice(0, 6)
  return out.length > 0 ? out : undefined
}

/** v4.1：解析机制关系（SP 用 target 机制名引用；无效 relation 丢弃） */
function normMechanismEdges(v: unknown, ownName: string): MechanismEdge[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v
    .map((item): MechanismEdge | null => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const target = str(o.target) || str(o.toMechanismId)
      const relation = str(o.relation)
      if (!target || target === ownName || !VALID_EDGE_RELATIONS.has(relation)) return null
      const weight = typeof o.weight === 'number' && Number.isFinite(o.weight)
        ? Math.max(0, Math.min(1, o.weight))
        : 0.5
      return {
        fromMechanismId: ownName,
        toMechanismId: target,
        relation: relation as MechanismEdge['relation'],
        weight,
        evidenceRefs: [],
        sceneNote: str(o.note) || undefined,
      }
    })
    .filter((x): x is MechanismEdge => Boolean(x))
    .slice(0, 4)
  return out.length > 0 ? out : undefined
}

function normMechanism(m: RawMechanism): CandidateMechanism {
  const strength = normStrength(m.overallStrength)
  const mechanismName = str(m.mechanismName, '未命名机制')
  return {
    mechanismName,
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
    sceneActivations: normSceneActivations(m.sceneActivations),
    relatedMechanismIds: normMechanismEdges(m.relatedMechanisms, mechanismName),
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
  maxTokens: number,
  options?: { systemSuffix?: string }
): Promise<T | undefined> {
  for (let attempt = 0; attempt <= DEEP_JSON_PARSE_RETRIES; attempt += 1) {
    try {
      return await callAgentJson<T>(agent, task, payload, {
        maxTokens,
        timeoutMs: DEEP_STEP_TIMEOUT_MS,
        systemSuffix: options?.systemSuffix,
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

export async function runDeepMechanismReview(
  tenant: TenantId,
  opts?: { reason?: string; forceFull?: boolean }
): Promise<boolean> {
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
      recentInputs: inputHistory.slice(-PARENT_INPUT_WINDOW).map((item) => [item.traceId || '', item.timestamp || '', item.text]),
    }))
    .digest('hex')
  const recon = await shouldReconceptualize(tenant, {
    sourceFingerprint,
    forceFull: opts?.forceFull,
    reason: opts?.reason,
  })
  const forceFullRun = recon.should
  if (forceFullRun) {
    console.info(`[deep-mechanism] reason=${opts?.reason || 'reconceptualize'} recon=${recon.reasons.join(',')}`)
  }
  const checkpoint = forceFullRun ? null : await loadDeepMechanismHandoff(tenant)
  const canResume = !forceFullRun && checkpoint?.sourceFingerprint === sourceFingerprint

  const packDigest = buildRichPackDigest(packs)
  const recentInputs = sliceParentInputTexts(inputHistory, PARENT_INPUT_WINDOW)
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
        { ecosystemMap },
        8192,
        {
          systemSuffix: `理论卡库（固定前缀，用于匹配；user 仅含 ecosystemMap）：\n${JSON.stringify(THEORY_CARDS, null, 2)}\n\n${theoryCardsSystemAppendix()}`,
        },
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
  let portraitOut: PortraitSynthesizeOutput | undefined
  const previousDossier = await getLatestDossier(tenant).catch(() => null)
  const usePortrait = isPortraitV3Enabled()

  const failedPredictions = recon.reasons.includes('prediction_failed')
    ? getFailedPredictions(previousDossier)
    : []

  if (usePortrait) {
    const portraitTask = '综合全量证据产出 FamilyUnderstandingDossier（schema v2）；理论仅作内部透镜。'
    const portraitSuffix = {
      systemSuffix: `理论卡库（20×9 rich fields，作内部判断透镜；输出理论隐身）：\n${JSON.stringify(THEORY_CARDS, null, 2)}\n\n${theoryCardsSystemAppendix()}`,
    }
    const portraitPayload = { ...sharedContext, ecosystemMap, theoryMatches, previousDossier, failedPredictions }
    try {
      portraitOut = await callDeepAgentJson<PortraitSynthesizeOutput>(
        'portraitSynthesizer',
        portraitTask,
        portraitPayload,
        12288,
        portraitSuffix,
      )
    } catch (error) {
      console.warn('[deep-mechanism] portraitSynthesizer 失败，回退 mechanismSynthesizer:', error)
    }
    // v4 post-gate：dossier 落库前校验。结构性违规（理论泄漏/无竞争假设/不可证伪）带反馈重试一次；
    // 置信虚高由代码直接钳制。重试仍违规则钳制后落库（降级优于空转）。
    if (portraitOut?.dossier?.workingHypothesis?.text) {
      let gate = gateDossier(portraitOut.dossier)
      if (hasRetryableViolations(gate.violations)) {
        console.warn(
          `[deep-mechanism] portrait post-gate 违规，带反馈重试: ${gate.violations.filter((v) => v.retryable).map((v) => v.code).join(',')}`
        )
        try {
          const retried = await callDeepAgentJson<PortraitSynthesizeOutput>(
            'portraitSynthesizer',
            `${portraitTask}\n\n${formatViolationsForRetry(gate.violations)}`,
            portraitPayload,
            12288,
            portraitSuffix,
          )
          if (retried?.dossier?.workingHypothesis?.text) {
            portraitOut = retried
            gate = gateDossier(retried.dossier)
          }
        } catch (error) {
          console.warn('[deep-mechanism] portrait post-gate 重试失败，钳制后落库:', error)
        }
      }
      if (gate.violations.length > 0) {
        console.warn(`[deep-mechanism] portrait post-gate: ${gate.violations.map((v) => v.code).join(',')}`)
      }
      portraitOut = { ...portraitOut, dossier: gate.fixed }
    }
    if (portraitOut?.dossier?.workingHypothesis?.text) {
      const version = (previousDossier?.version || 0) + 1
      await saveDossierVersion(
        {
          ...portraitOut.dossier,
          version,
          updatedAt: new Date().toISOString(),
          changeLog: portraitOut.dossier.changeLog?.length
            ? portraitOut.dossier.changeLog
            : [`v${version}: portraitSynthesizer 全量整合`],
        },
        tenant
      ).catch((err) => console.warn('[deep-mechanism] saveDossierVersion 失败:', err))
      void buildDeepModelDigest(tenant).catch(() => {})
    }
  }

  if (!portraitOut?.dossier?.workingHypothesis?.text) {
    const synthesisTask = '综合理论匹配与全量证据，产出多域深度机制矩阵（目标10–20条）。'
    const synthesisPayload = { ...sharedContext, ecosystemMap, theoryMatches }
    try {
      ai = await callDeepAgentJson<MechanismSynthesizeOutput>(
        'mechanismSynthesizer',
        synthesisTask,
        synthesisPayload,
        12288,
      )
    } catch (error) {
      console.warn('[deep-mechanism] 多域综合失败，尝试 legacy 回退:', error)
    }

    // v4 post-gate：中间变量机制名（拖延机制/逃避机制…）是结构性违规，带反馈重试一次；
    // 其余违规（虚高强度/伪造卡ID/空壳）由落库前统一钳制，不在此消耗重试额度。
    if (ai?.candidateMechanismMatrix?.length) {
      const pre = gateMechanismMatrix(
        ai.candidateMechanismMatrix.map((m) => normMechanism(m)),
        VALID_THEORY_CARD_IDS
      )
      if (hasRetryableViolations(pre.violations)) {
        console.warn(
          `[deep-mechanism] 机制矩阵 post-gate 违规，带反馈重试: ${pre.violations.filter((v) => v.retryable).map((v) => v.code).join(',')}`
        )
        try {
          const retried = await callDeepAgentJson<MechanismSynthesizeOutput>(
            'mechanismSynthesizer',
            `${synthesisTask}\n\n${formatViolationsForRetry(pre.violations)}`,
            synthesisPayload,
            12288,
          )
          if (retried?.candidateMechanismMatrix?.length) ai = retried
        } catch (error) {
          console.warn('[deep-mechanism] 机制矩阵 post-gate 重试失败，钳制后落库:', error)
        }
      }
    }

    if (!ai?.candidateMechanismMatrix?.length) {
      ai = await runLegacyMonolith({ ...sharedContext, ecosystemMap, theoryMatches })
    }
  } else {
    ai = {
      candidateMechanismMatrix: portraitOut.candidateMechanismMatrix,
      pendingHypotheses: portraitOut.pendingHypotheses,
      parentNarrativePattern: portraitOut.parentNarrativePattern,
    }
  }

  if (!ai?.candidateMechanismMatrix?.length && !portraitOut?.dossier?.workingHypothesis?.text) return false
  if (!ai?.candidateMechanismMatrix?.length && portraitOut?.dossier) {
    ai = {
      candidateMechanismMatrix: existingNetwork?.candidateMechanismMatrix || [],
      pendingHypotheses: portraitOut.pendingHypotheses,
      parentNarrativePattern: portraitOut.parentNarrativePattern,
    }
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

  // v4 post-gate：落库前统一钳制（零证据丢弃 / 三源规则封顶 high / 空壳降级 / 伪造卡ID清除）。
  // 全部机制被丢弃时保留原矩阵落库并告警——空网络对下游的伤害大于降级数据。
  const normalizedMatrix = ai.candidateMechanismMatrix.map((m) => normMechanism(m))
  const matrixGate = gateMechanismMatrix(normalizedMatrix, VALID_THEORY_CARD_IDS)
  if (matrixGate.violations.length > 0) {
    console.warn(`[deep-mechanism] 机制矩阵 post-gate: ${matrixGate.violations.map((v) => v.code).join(',')}`)
  }
  const gatedMatrix = matrixGate.fixed.length > 0 ? matrixGate.fixed : normalizedMatrix

  // v4.1：机制→证据确定性回填。theoryMatcher 已产出 matchedFactIds，
  // 按 theoryCardId 把事实引用写回机制 evidenceRefs，让「激活机制→取其证据」
  // 可结构化执行（零 LLM 成本；LLM 未给 evidenceRefs 时才回填，不覆盖）。
  const factById = new Map(flatFacts.map((f) => [f.factId, f]))
  const matchedFactIdsByCard = new Map<string, string[]>()
  for (const tm of theoryMatches) {
    if (!tm.theoryCardId) continue
    matchedFactIdsByCard.set(tm.theoryCardId, [
      ...(matchedFactIdsByCard.get(tm.theoryCardId) || []),
      ...tm.matchedFactIds,
    ])
  }
  for (const m of gatedMatrix) {
    if (m.evidenceRefs?.length || !m.theoryCardId) continue
    const refs: EvidenceRef[] = [...new Set(matchedFactIdsByCard.get(m.theoryCardId) || [])]
      .map((fid) => factById.get(fid))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
      .slice(0, 6)
      .map((f) => ({
        evidenceId: f.factId,
        weight: 0.6,
        quote: f.text.slice(0, 120),
        source: 'entry_evidence' as const,
        epistemicStatus: 'reported' as const,
      }))
    if (refs.length > 0) m.evidenceRefs = refs
  }

  const network: CrossEntryEvidenceNetwork = {
    networkId: existingNetwork?.networkId || createId('net'),
    familyId: tenant.familyId,
    childId: tenant.childId,
    maturityLevel: maturity.level,
    inputCoverage: coverage,
    crossEntryEvidenceMap: existingNetwork?.crossEntryEvidenceMap || [],
    candidateMechanismMatrix: gatedMatrix,
    mechanismLayerSource: 'deep_mechanism',
    createdAt: existingNetwork?.createdAt || now,
    updatedAt: now,
  }
  await saveEvidenceNetwork(network, tenant)

  // v4.1：atom→机制反向索引（异步，失败不阻断；机制集每轮全量替换）
  void linkAtomsToMechanisms(network.candidateMechanismMatrix, tenant)
    .then((count) => {
      if (count > 0) console.info(`[deep-mechanism] atom→机制反向索引写回 ${count} 条`)
    })
    .catch((err) => console.warn('[deep-mechanism] atom→机制链接构建失败（不影响主流程）:', err))

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

  // v4：每轮 deep_mechanism_review 后增量更新 family_agent_persona
  await updateFamilyAgentPersona(tenant).catch((err) => {
    console.error('[deep-mechanism] persona 更新失败:', err)
  })

  return true
}

/**
 * v4：调用 personaSynthesizer Agent 生成/增量更新家庭 persona。
 * 失败不阻断 deep_mechanism_review 主流程。
 */
async function updateFamilyAgentPersona(tenant: TenantId): Promise<void> {
  const currentPersona = await loadFamilyAgentPersona(tenant)
  const dossier = currentPersona ? null : null // dossier 通过 digest 读，此处简化
  const parentInputHistory = (await getMergedParentInputHistory(tenant, 10)).map(h => h.text).filter(Boolean).slice(0, 10)
  if (parentInputHistory.length === 0 && currentPersona) return

  const ai = await callAgentJson<{
    parentTraits: FamilyAgentPersona['parentTraits']
    childTraits: FamilyAgentPersona['childTraits']
    familyClimate: FamilyAgentPersona['familyClimate']
    toneCalibration: FamilyAgentPersona['toneCalibration']
    questionStrategy: FamilyAgentPersona['questionStrategy']
  }>('personaSynthesizer', '生成或增量更新家庭 Agent persona', {
    familyId: tenant.familyId,
    currentPersona,
    dossier,
    parentInputHistory,
  }, { maxTokens: 2048 })

  if (!ai) return

  // 平滑更新：新值 = 0.6 × 旧值 + 0.4 × 新判定值（首次生成直接用判定值）
  const prev = currentPersona ?? buildDefaultPersona(tenant.familyId)
  const smooth = (oldVal: number, newVal: number | undefined) =>
    newVal === undefined ? oldVal : currentPersona ? 0.6 * oldVal + 0.4 * newVal : newVal

  const updated: FamilyAgentPersona = {
    familyId: tenant.familyId,
    parentTraits: {
      anxietyLevel: smooth(prev.parentTraits.anxietyLevel, ai.parentTraits?.anxietyLevel),
      controlTendency: smooth(prev.parentTraits.controlTendency, ai.parentTraits?.controlTendency),
      reflectivity: smooth(prev.parentTraits.reflectivity, ai.parentTraits?.reflectivity),
    },
    childTraits: {
      ageStage: ai.childTraits?.ageStage || prev.childTraits.ageStage,
      temperament: ai.childTraits?.temperament || prev.childTraits.temperament,
    },
    familyClimate: {
      conflictFrequency: smooth(prev.familyClimate.conflictFrequency, ai.familyClimate?.conflictFrequency),
      supportLevel: smooth(prev.familyClimate.supportLevel, ai.familyClimate?.supportLevel),
    },
    toneCalibration: ai.toneCalibration || prev.toneCalibration,
    questionStrategy: ai.questionStrategy || prev.questionStrategy,
    updatedAt: new Date().toISOString(),
    version: (prev.version || 0) + 1,
  }
  await saveFamilyAgentPersona(updated, tenant)
  console.info(`[deep-mechanism] persona 更新成功 v${updated.version}`)
}

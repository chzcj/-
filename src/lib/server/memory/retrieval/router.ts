import type {
  DailyDialogueRetrievalPacket,
  DiagnosisRetrievalPacket,
  EntryCollectionRetrievalPacket,
  SynthesisRetrievalPacket,
  EntryName,
  ParentNarrativePattern,
} from '@/types/database'
import { getCurrentMaturityState } from '@/lib/server/context/maturity'
import { isEmbeddingEnabled, rankByRelevance } from '../embedding'
import { retrieveContextPack } from './episode-retriever'
import type { TenantId } from '../tenant'
import {
  getEntryEvidencePacks,
  getEntryEvidencePack,
  getLatestEvidenceNetwork,
  getLatestChildStructureModel,
  getConditionalProfiles,
  getPendingHypotheses,
  getFamilyInteractionCycles,
  getDailyInteractionUpdates,
  getLatestBuiltProfileSnapshot,
  getBuildProgress,
  getMergedParentInputHistory,
  getParentNarrativePattern,
} from '../../memory/database-manager'
import { humanizeBuiltJudgment } from '@/lib/server/daily/profile-sanitize'
import { formatMatchedMechanismCards } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { getFrontendReadSliceLimits } from '@/lib/server/daily/frontend-read-pack'
import { getLatestDossier } from '@/lib/server/memory/deep-modeling/digest-store'
import { flattenDossierSlice, sliceForDaily } from '@/lib/server/memory/dossier/dossier-slicer'
import { isPortraitV3Enabled } from '@/lib/server/memory/dossier/portrait-v3-flags'

/* ================================================================
   Retrieval Router — 检索路由
   ================================================================ */

function promoteMaturity(
  currentLevel: ReturnType<typeof getCurrentMaturityState>['level'],
  signals: {
    profiles?: number
    hasModel?: boolean
    hasNetwork?: boolean
    packs?: number
    hasBuiltSnapshot?: boolean
    completedEntries?: number
    dailyUpdates?: number
  }
) {
  if (signals.hasModel || (signals.profiles || 0) > 0) return 'L3' as const
  if (signals.hasBuiltSnapshot && (signals.dailyUpdates || 0) >= 5) return 'L4' as const
  if (signals.hasBuiltSnapshot) return 'L3' as const
  if (signals.hasNetwork || (signals.packs || 0) >= 3) return 'L2' as const
  if ((signals.completedEntries || 0) >= 4) return 'L2' as const
  if ((signals.dailyUpdates || 0) >= 3) return 'L2' as const
  return currentLevel
}

function buildParentUnderstanding(
  pattern: ParentNarrativePattern | null,
  packs: Awaited<ReturnType<typeof getEntryEvidencePacks>>
): Record<string, unknown> {
  const parentGoals = [...new Set(packs.flatMap((p) => p.decomposedInput.parentGoals || []))].slice(0, 3)
  const parentActions = [...new Set(packs.flatMap((p) => p.decomposedInput.parentActions || []))].slice(0, 4)

  if (!pattern && parentGoals.length === 0 && parentActions.length === 0) {
    return {}
  }

  return {
    observations: pattern?.observations?.slice(0, 5) || [],
    interactionImplications: pattern?.interactionImplications?.slice(0, 4) || [],
    correctionReceptivity: pattern?.correctionReceptivity,
    factProvisionAbility: pattern?.factProvisionAbility,
    typicalParentGoals: parentGoals,
    typicalParentActions: parentActions,
  }
}

export function flattenParentUnderstanding(packet: Record<string, unknown>): string[] {
  const lines: string[] = []
  for (const key of [
    'observations',
    'interactionImplications',
    'typicalParentGoals',
    'typicalParentActions',
  ] as const) {
    const val = packet[key]
    if (Array.isArray(val)) lines.push(...val.filter((x): x is string => typeof x === 'string'))
  }
  const receptivity = packet.correctionReceptivity
  if (typeof receptivity === 'string' && receptivity.trim()) {
    lines.push(`家长纠偏开放度：${receptivity.trim()}`)
  }
  const factAbility = packet.factProvisionAbility
  if (typeof factAbility === 'string' && factAbility.trim()) {
    lines.push(`家长提供具体事实能力：${factAbility.trim()}`)
  }
  const limit = getFrontendReadSliceLimits().parentUnderstanding
  return lines.slice(0, limit)
}

export async function buildDailyDialogueRetrievalPacket(
  query: string | undefined,
  tenant: TenantId,
  _options?: { fast?: boolean }
): Promise<DailyDialogueRetrievalPacket> {
  const maturity = getCurrentMaturityState(tenant)
  const [profiles, packs, updates, hypotheses, network, model, cycles, builtSnapshot, buildProgress, parentPattern] = await Promise.all([
    getConditionalProfiles(tenant),
    getEntryEvidencePacks(tenant),
    getDailyInteractionUpdates(tenant),
    getPendingHypotheses(tenant),
    getLatestEvidenceNetwork(tenant),
    getLatestChildStructureModel(tenant),
    getFamilyInteractionCycles(tenant),
    getLatestBuiltProfileSnapshot(tenant),
    getBuildProgress(tenant),
    getParentNarrativePattern(tenant),
  ])
  const completedEntries = buildProgress?.completedEntries?.length || 0
  const effectiveLevel = promoteMaturity(maturity.level, {
    profiles: profiles.length,
    hasModel: Boolean(model),
    hasNetwork: Boolean(network),
    packs: packs.length,
    hasBuiltSnapshot: Boolean(builtSnapshot?.coreJudgment),
    completedEntries,
    dailyUpdates: updates.length,
  })

  // 候选事实池：daily_updates + turn_events 合并，避免只写 TurnEvent 未写 L9 时丢历史。
  const inputHistory = await getMergedParentInputHistory(tenant, 100)
  const allEvents = inputHistory.map((h) => h.text).filter(Boolean)

  // 三级降级链：① Episode 语义检索 → ② 向量精排 → ③ 取最近。
  // 注意：即使上游传入 fast，也不能跳过本轮 query 的语义检索；否则同线程会锁死首轮记忆。
  let recentEvents: string[]
  let supportingEvidence: string[]
  const pack = query ? await retrieveContextPack(query, { familyId: tenant.familyId, childId: tenant.childId }) : undefined
  if (pack) {
    const episodeTexts = pack.episodes.map(e => e.summary)
    const highValueAtomTexts = pack.episodes
      .flatMap(e => e.atoms.filter(a => a.isHighValue).map(a => a.content))
      .concat(pack.extraHighValueAtoms.map(a => a.content))
    recentEvents = episodeTexts.length > 0 ? episodeTexts : allEvents.slice(-20)
    supportingEvidence = [...episodeTexts.slice(0, 8), ...highValueAtomTexts.slice(0, 7)]
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 15)
    if (supportingEvidence.length === 0) supportingEvidence = allEvents.slice(-12)
  } else if (query && isEmbeddingEnabled() && allEvents.length > 0) {
    const ranked = await rankByRelevance(query, allEvents, (e) => e, 20)
    recentEvents = ranked.map(r => r.item)
    supportingEvidence = ranked.slice(0, 15).map(r => r.item)
  } else {
    recentEvents = allEvents.slice(-20)
    supportingEvidence = allEvents.slice(-12)
  }

  const slice = getFrontendReadSliceLimits()

  const profileTexts = profiles.map(p => p.childTendency)
  // childQuotes：优先从 entry packs 行为里抽短原话/引号句；厚包上限对齐 frontend-read-pack。
  const childQuotes = [
    ...new Set(
      packs.flatMap((p) =>
        (p.decomposedInput.childBehaviors || []).filter((b) => /[「"'']/.test(b) || b.length <= 40)
      )
    ),
  ].slice(0, slice.childQuotes)
  const parentVerbatimSnippets = inputHistory
    .map((h) => h.text?.trim())
    .filter((t): t is string => Boolean(t && t.length >= 12))
    .slice(-slice.parentVerbatimSnippets)
  // 具体事实直喂：四模块采集的 verifiableFacts/childBehaviors/triggerPoints 合并去重，
  // 让前端 AI 直接读到"错题本只抄答案"这类具体场景，而不是只拿 episode 摘要。
  // 2026-07 增补：维度字段（方法-效果/夫妻分歧/陪伴节律/兴趣/科目状态）格式化后一并直喂。
  // S6：预切上限对齐厚/薄包，避免 router 先砍到 10 再喂 pickFrontendReadPack(40)。
  const entryFacts = [
    ...new Set(
      packs.flatMap(p => [
        ...(p.decomposedInput.verifiableFacts || []),
        ...(p.decomposedInput.childBehaviors || []),
        ...(p.decomposedInput.triggerPoints || []),
        ...(p.decomposedInput.triedMethods || []).map((t) =>
          t.effect ? `试过：${t.method}（结果：${t.effect}）` : `试过：${t.method}`
        ),
        ...(p.decomposedInput.parentDisagreements || []).map((s) => `家庭教育分歧：${s}`),
        ...(p.decomposedInput.companionshipTime ? [`陪伴节律：${p.decomposedInput.companionshipTime}`] : []),
        ...(p.decomposedInput.childInterests || []).map((s) => `孩子兴趣：${s}`),
        ...(p.decomposedInput.subjectStates || []).map((s) => `学科状态·${s.subject}：${s.state}`),
      ]).filter(Boolean)
    ),
  ].slice(0, slice.entryFacts)
  const familyInteractionPatterns = cycles
    .map((c) => {
      const parts = [c.cycleName, c.parentTriggerAction, c.childReaction].filter(Boolean)
      return parts.join('：').trim()
    })
    .filter(Boolean)
    .slice(0, slice.familyPatterns)

  /** 四模块证据包摘要 → 契约 entryEvidence（勿与 episode supportingEvidence 混用） */
  const entryEvidencePackSummaries = packs
    .map((p) => {
      const name = p.entryName || 'module'
      const summary = (p.rawInputSummary || '').trim()
      if (!summary) return ''
      return `[${name}] ${summary.slice(0, 500)}`
    })
    .filter(Boolean)
    .slice(0, slice.entryEvidence)

  const matchingProfile = model?.primaryConditionalProfile?.childTendency || null
  const relevantChildStructureModels = [...profileTexts]
  if (relevantChildStructureModels.length === 0 && builtSnapshot?.coreJudgment) {
    relevantChildStructureModels.push(
      humanizeBuiltJudgment(builtSnapshot.coreJudgment, {
        deepMechanism: builtSnapshot.deepMechanism,
        supportFocus: builtSnapshot.supportFocus,
        mechanism: network?.candidateMechanismMatrix?.[0]?.mechanismName,
      })
    )
  }
  if (relevantChildStructureModels.length === 0 && builtSnapshot?.deepMechanism) {
    relevantChildStructureModels.push(builtSnapshot.deepMechanism)
  }
  if (relevantChildStructureModels.length === 0 && matchingProfile) {
    relevantChildStructureModels.push(matchingProfile)
  }

  if (network?.mechanismLayerSource) {
    console.info(
      `[retrieval] mechanismLayerSource=${network.mechanismLayerSource} matrix=${network.candidateMechanismMatrix?.length || 0}`
    )
  }

  const builtEvidence = (builtSnapshot?.evidence || [])
    .map((e) => e.evidenceText || e.explanation)
    .filter(Boolean)
    .slice(0, 3) as string[]

  const dossier = isPortraitV3Enabled() ? await getLatestDossier(tenant).catch(() => null) : null
  const dossierSliceLines = dossier
    ? flattenDossierSlice(sliceForDaily(query || '', dossier))
    : []
  const matchedMechanisms = formatMatchedMechanismCards(network?.candidateMechanismMatrix)

  return {
    retrievalPurpose: 'daily_dialogue',
    contextMaturityLevel: effectiveLevel,
    currentInputClassification: 'insufficient',
    relevantChildStructureModels,
    matchedMechanisms,
    dossierSlice: dossierSliceLines,
    supportingEvidence: supportingEvidence.length > 0 ? supportingEvidence : builtEvidence.length > 0 ? builtEvidence : allEvents.slice(-5),
    recentRelatedEvents: recentEvents,
    pendingHypotheses: hypotheses.map(h => h.hypothesis),
    possibleCounterEvidence: [],
    childQuotes,
    parentVerbatimSnippets,
    entryFacts,
    entryEvidencePackSummaries,
    familyInteractionPatterns,
    parentNarrativePattern: buildParentUnderstanding(parentPattern, packs),
    recommendedHandling: {
      canExplainWithExistingModel:
        profiles.length > 0 ||
        model?.primaryConditionalProfile != null ||
        Boolean(builtSnapshot?.coreJudgment),
      shouldAskFollowup: effectiveLevel === 'L0' || (effectiveLevel === 'L1' && !builtSnapshot?.coreJudgment),
      followupTarget: '',
      shouldTriggerResynthesis: false,
      shouldUpdateMemory: true,
      responseGuidance: effectiveLevel === 'L0'
        ? '引导家长进入五入口采集'
        : effectiveLevel === 'L1'
        ? '继续入口采集，不急于综合'
        : '基于已有画像尝试解释，不重复追问基础信息'
    }
  }
}

export async function buildDiagnosisRetrievalPacket(tenant: TenantId): Promise<DiagnosisRetrievalPacket> {
  const maturity = getCurrentMaturityState(tenant)
  const [packs, profiles, network, hypotheses, cycles, model] = await Promise.all([
    getEntryEvidencePacks(tenant),
    getConditionalProfiles(tenant),
    getLatestEvidenceNetwork(tenant),
    getPendingHypotheses(tenant),
    getFamilyInteractionCycles(tenant),
    getLatestChildStructureModel(tenant)
  ])
  const effectiveLevel = promoteMaturity(maturity.level, {
    profiles: profiles.length,
    hasModel: Boolean(model),
    hasNetwork: Boolean(network),
    packs: packs.length
  })

  return {
    retrievalPurpose: 'deep_diagnosis',
    contextMaturityLevel: effectiveLevel,
    mainMechanismCandidates: network?.candidateMechanismMatrix?.map(m => m.mechanismName) || [],
    crossEntryEvidenceNetwork: packs.map(p => `[${p.entryName}] ${p.rawInputSummary}`),
    highStrengthEvidence: network?.candidateMechanismMatrix?.filter(m => m.overallStrength === 'high').map(m => m.description) || [],
    childQuotes: [],
    parentQuotes: [],
    familyInteractionCycles: cycles.map(c => c.cycleName),
    childProtectiveStrategies: model?.dominantProtectiveStrategies || [],
    parentMisreadings: [],
    pendingBoundaries: profiles.flatMap(p => p.boundaries),
    doNotOverstate: [],
    recommendedDiagnosisStrength: effectiveLevel === 'L4' ? 'core_profile' : effectiveLevel === 'L3' ? 'core_profile' : 'stage'
  }
}

export async function buildEntryCollectionRetrievalPacket(targetEntry: EntryName, tenant: TenantId): Promise<EntryCollectionRetrievalPacket> {
  const existingPack = await getEntryEvidencePack(targetEntry, tenant)

  return {
    retrievalPurpose: 'entry_collection',
    targetEntry,
    existingEntryPack: existingPack,
    alreadyAskedQuestions: existingPack?.alreadyAskedQuestions || [],
    knownFactsForThisEntry: existingPack?.decomposedInput.verifiableFacts || [],
    missingKeyInfo: existingPack?.decomposedInput.missingInformation || [],
    crossEntrySignals: existingPack?.crossEntrySignals || [],
    doNotRepeat: existingPack?.alreadyAskedQuestions || [],
    bestNextQuestionCandidate: existingPack?.followupCandidates?.[0]
      ? {
          question: existingPack.followupCandidates[0].question,
          purpose: existingPack.followupCandidates[0].purpose,
          targetHypothesis: existingPack.followupCandidates[0].targetMechanism
        }
      : null
  }
}

export async function buildSynthesisRetrievalPacket(tenant: TenantId): Promise<SynthesisRetrievalPacket> {
  const maturity = getCurrentMaturityState(tenant)
  const [packs, profiles, hypotheses, updates, network, model] = await Promise.all([
    getEntryEvidencePacks(tenant),
    getConditionalProfiles(tenant),
    getPendingHypotheses(tenant),
    getDailyInteractionUpdates(tenant),
    getLatestEvidenceNetwork(tenant),
    getLatestChildStructureModel(tenant)
  ])
  const effectiveLevel = promoteMaturity(maturity.level, {
    profiles: profiles.length,
    hasModel: Boolean(model),
    hasNetwork: Boolean(network),
    packs: packs.length
  })

  const entryCoverage = {
    learning_homework: (packs.some(p => p.entryName === 'learning_homework') ? 'sufficient' : 'missing') as 'sufficient' | 'missing',
    daily_rhythm_phone: (packs.some(p => p.entryName === 'daily_rhythm_phone') ? 'sufficient' : 'missing') as 'sufficient' | 'missing',
    parent_child_communication: (packs.some(p => p.entryName === 'parent_child_communication') ? 'sufficient' : 'missing') as 'sufficient' | 'missing',
    emotional_stress: (packs.some(p => p.entryName === 'emotional_stress') ? 'sufficient' : 'missing') as 'sufficient' | 'missing',
    relationship_environment: (packs.some(p => p.entryName === 'relationship_environment') ? 'sufficient' : 'missing') as 'sufficient' | 'missing'
  }

  return {
    retrievalPurpose: 'multi_entry_synthesis',
    entryCoverage,
    entryEvidencePacks: packs,
    existingEvidenceNetwork: network,
    stableProfiles: profiles.filter(p => p.status === 'stable'),
    stageJudgments: profiles.filter(p => p.status === 'stage_judgment'),
    pendingHypotheses: hypotheses,
    recentUpdates: updates.slice(-10),
    counterEvidence: [],
    mechanismsToReevaluate: [],
    suggestedSynthesisFocus: effectiveLevel === 'L0' ? [] : ['基于现有结构模型继续交叉验证']
  }
}

/* ================================================================
   教育模式诊断专项检索（交付文档 5.3）。轻量复用三层语义检索：
   带出既往已采集的生活流水事实 + [教育诊断] 历史，供 LLM 判 readiness。
   不落新表，已采集事实由 Episode/dailyUpdate 层累积。
   ================================================================ */
export interface EducationDiagnosisRetrievalPacket {
  knownFacts: string[]          // 语义召回的相关家庭事实（Episode summary + 高价值原话）
  recentEducationEvents: string[] // 既往 [教育诊断] 采集历史
  childUnderstanding: string[]  // 已有孩子画像倾向
  maturityLevel: ReturnType<typeof getCurrentMaturityState>['level']
}

export async function buildEducationDiagnosisRetrievalPacket(
  query: string | undefined,
  tenant: TenantId
): Promise<EducationDiagnosisRetrievalPacket> {
  const maturity = getCurrentMaturityState(tenant)
  const [profiles, model, updates] = await Promise.all([
    getConditionalProfiles(tenant),
    getLatestChildStructureModel(tenant),
    getDailyInteractionUpdates(tenant)
  ])

  // 既往本功能采集历史（按 [教育诊断] 前缀过滤）。
  const recentEducationEvents = updates
    .map(u => u.newInput)
    .filter((t): t is string => Boolean(t) && t.includes('[教育诊断]'))
    .slice(-6)

  // 语义召回相关家庭事实（三层检索；不可用则空，由 LLM 仅据本轮输入判 readiness）。
  let knownFacts: string[] = []
  const pack = query ? await retrieveContextPack(query, { familyId: tenant.familyId, childId: tenant.childId }) : undefined
  if (pack) {
    const episodeTexts = pack.episodes.map(e => e.summary)
    const highValueAtomTexts = pack.episodes
      .flatMap(e => e.atoms.filter(a => a.isHighValue).map(a => a.content))
      .concat(pack.extraHighValueAtoms.map(a => a.content))
    knownFacts = [...episodeTexts.slice(0, 5), ...highValueAtomTexts.slice(0, 3)]
  }

  const childUnderstanding = profiles.length > 0
    ? profiles.map(p => p.childTendency).slice(0, 3)
    : (model?.primaryConditionalProfile?.childTendency ? [model.primaryConditionalProfile.childTendency] : [])

  return {
    knownFacts,
    recentEducationEvents,
    childUnderstanding,
    maturityLevel: maturity.level
  }
}

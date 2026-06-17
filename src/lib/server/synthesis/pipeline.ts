import type {
  SynthesisOutput,
  EntryEvidencePack,
  CrossEntryEvidence,
  CandidateMechanism,
  MechanismScore,
  EntryName,
  MaturityLevel,
  EvidenceStrength
} from '@/types/database'
import { createId } from '@/lib/storage/storageIds'
import { callFastJson } from '@/lib/server/ark-agents'
import { agentPrompts } from '@/lib/server/agent-prompts'

/* ================================================================
   Synthesis Pipeline — 多入口综合建模 Agent 编排
   调用 AI Agent 进行跨入口综合分析
   ================================================================ */

export interface SynthesisInput {
  maturityLevel: MaturityLevel
  entryPacks: EntryEvidencePack[]
  existingNetwork?: unknown | null
  existingProfiles?: string[]
  crossCuttingSupplement?: string // final-follow-up 的综合补充（跨入口关键点）
}

interface AiSynthesisOutput {
  crossEntryEvidenceMap: Array<{
    sourceEntries: string[]
    surfaceBehaviors: string[]
    triggerPoints: string[]
    parentActions: string[]
    childReactions: string[]
    childQuotes: string[]
    parentInterpretations: string[]
    possibleSharedFunction: string
    evidenceStrength: string
    notes: string
  }>
  candidateMechanismMatrix: Array<{
    mechanismName: string
    mechanismType: string
    description: string
    supportedByEntries: string[]
    supportingEvidence: string[]
    explainedBehaviors: string[]
    possibleProtectiveFunction: string
    overallStrength: string
    applicableScope: string
    missingEvidence: string[]
    shouldPromoteToDiagnosis: boolean
  }>
  childStructureModelDraft: {
    primaryConditionalProfile: string
    secondaryConditionalProfiles: string[]
    dominantProtectiveStrategies: string[]
    likelyFamilyInteractionPatterns: string[]
  }
  diagnosisHandoffPackage: {
    recommendedDiagnosisStrength: string
    mainMechanismToExplain: string
    keyEvidencePath: string[]
    parentMisreadingsToCorrect: string[]
    childPerspectiveToTranslate: string[]
    doNotOverstate: string[]
    mustKeepBoundary: string[]
    stillNeedToVerify: string[]
  }
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function normalizeStrength(value: unknown): EvidenceStrength {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  if (typeof value === 'number') {
    if (value >= 0.75) return 'high'
    if (value >= 0.45) return 'medium'
    return 'low'
  }
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    const numeric = Number(text)
    if (!Number.isNaN(numeric)) return normalizeStrength(numeric)
    if (['strong', 'high_confidence', '高', '强'].includes(text)) return 'high'
    if (['weak', 'low_confidence', '低', '弱'].includes(text)) return 'low'
  }
  return 'medium'
}

export async function runSynthesisPipeline(input: SynthesisInput): Promise<SynthesisOutput> {
  const now = new Date().toISOString()
  const packs = input.entryPacks

  const inputCoverage: Record<EntryName, 'missing' | 'partial' | 'sufficient' | 'strong'> = {
    learning_homework: packs.some(p => p.entryName === 'learning_homework') ? 'sufficient' : 'missing',
    daily_rhythm_phone: packs.some(p => p.entryName === 'daily_rhythm_phone') ? 'sufficient' : 'missing',
    parent_child_communication: packs.some(p => p.entryName === 'parent_child_communication') ? 'sufficient' : 'missing',
    emotional_stress: packs.some(p => p.entryName === 'emotional_stress') ? 'sufficient' : 'missing',
    relationship_environment: packs.some(p => p.entryName === 'relationship_environment') ? 'sufficient' : 'missing'
  }

  const completedCount = Object.values(inputCoverage).filter(v => v !== 'missing').length

  if (completedCount === 0) {
    return buildEmptyOutput(inputCoverage)
  }

  /* 构建给 AI 的每个入口总结 — 只传结构化摘要，不传原始文本 */
   const entrySummaries = packs.map(p => ({
     entryName: p.entryName,
     stageSummary: p.handoffToSummaryAgent.mostLikelyLocalMechanisms?.[0] || p.rawInputSummary.slice(0, 100),
     keyFacts: p.decomposedInput.verifiableFacts.slice(0, 4),
     keyBehaviors: p.decomposedInput.childBehaviors.slice(0, 3),
     keyTriggers: p.decomposedInput.triggerPoints.slice(0, 2),
     keyParentActions: p.decomposedInput.parentActions.slice(0, 2),
     keyGaps: p.decomposedInput.missingInformation.slice(0, 2),
   }))

  const taskPrompt = `你有 ${completedCount} 个入口的证据材料。请进行跨入口综合分析。

核心任务：
1. 找出跨多个入口重复出现的孩子行为模式和家长触发动作
2. 找出跨场景的孩子保护策略（这些策略在不同入口里表面行为不同，但功能相同）
3. 识别家庭互动循环（家长动作→孩子接收→孩子反应→家长解读→家长强化）
4. 生成条件化孩子结构模型草案（不能是标签，必须是"在X条件下更容易Y"）
5. 准备给深层诊断 Agent 的诊断材料包

规则：
- 不能把家长评价（"不自觉""没内驱力""安逸"）写成孩子事实
- 不能停在"启动困难""评价敏感""压力较大"这些中间变量
- 要找不同表面行为背后的共同功能
- 每个跨入口关联必须有具体证据来源和入口出处
- candidateMechanismMatrix 里至少要有 5 条，每条必须有 mechanismName、supportingEvidence、overallStrength
- crossEntryEvidenceMap 里至少要有 6 条跨入口关联
- 输出完整 JSON，不要省略字段${input.crossCuttingSupplement ? `

家长在五入口之后补充的一个综合关键点（请在综合判断时重点纳入，但同样不能当成既定结论）：
${input.crossCuttingSupplement}` : ''}`;

  const aiResult = await callFastJson<AiSynthesisOutput>(
    agentPrompts.multiEntrySynthesis,
    { task: taskPrompt, entryPacks: entrySummaries, completedCount, maturityLevel: input.maturityLevel }
  ).catch(() => undefined as AiSynthesisOutput | undefined)

  const aiOutput = aiResult

  /* 合并 AI 输出与计算字段 */
  const crossEntryEvidence: CrossEntryEvidence[] = aiOutput?.crossEntryEvidenceMap?.length
    ? aiOutput.crossEntryEvidenceMap.map((e, i) => {
        const record = e as unknown as Record<string, unknown>
        const surfaceBehaviors = asStringArray(record.surfaceBehaviors)
        const triggerPoints = asStringArray(record.triggerPoints)
        const parentActions = asStringArray(record.parentActions)
        const childReactions = asStringArray(record.childReactions)
        const sharedFunction = firstString(record, [
          'possibleSharedFunction',
          'sharedFunction',
          'sharedPurpose',
          'protectiveFunction',
          'possibleProtectiveFunction',
          'commonFunction'
        ])
        const notes = firstString(record, ['notes', 'evidenceDescription', 'reasoning', 'description'])

        return {
          evidenceId: createId('ev-cross'),
          sourceEntries: (asStringArray(record.sourceEntries).length ? asStringArray(record.sourceEntries) : packs.map(p => p.entryName)) as EntryName[],
          surfaceBehaviors,
          triggerPoints,
          parentActions,
          childReactions,
          childQuotes: asStringArray(record.childQuotes),
          parentInterpretations: asStringArray(record.parentInterpretations),
          possibleSharedFunction: sharedFunction || notes || [
            ...surfaceBehaviors.slice(0, 2),
            ...triggerPoints.slice(0, 1),
            ...parentActions.slice(0, 1),
            ...childReactions.slice(0, 1)
          ].filter(Boolean).join('；'),
          evidenceStrength: normalizeStrength(record.evidenceStrength),
          notes
        }
      })
    : [buildFallbackCrossEntry(packs, completedCount)]

  const defaultScores: MechanismScore = {
    evidenceSpecificity: completedCount >= 5 ? 4 : 3,
    crossEntryRepetition: completedCount >= 3 ? 4 : 2,
    explanatoryCoverage: 3,
    familyChainCompleteness: completedCount >= 5 ? 4 : 2,
    protectiveFunctionClarity: 3,
    counterInfoCompatibility: 3,
    verifiability: 4,
    familySpecificity: 3
  }

  const mechanismMatrix: CandidateMechanism[] = aiOutput?.candidateMechanismMatrix?.length
    ? aiOutput.candidateMechanismMatrix.map(m => {
      const record = m as unknown as Record<string, unknown>
      const mechanismName = firstString(record, ['mechanismName', 'name', 'title'])
      return {
        mechanismName,
        mechanismType: (firstString(record, ['mechanismType']) || 'stage_candidate') as 'core_candidate' | 'stage_candidate' | 'pending_hypothesis',
        description: firstString(record, ['description', 'summary']) || mechanismName,
        supportedByEntries: (asStringArray(record.supportedByEntries).length ? asStringArray(record.supportedByEntries) : packs.map(p => p.entryName)) as EntryName[],
        supportingEvidence: asStringArray(record.supportingEvidence),
        explainedBehaviors: asStringArray(record.explainedBehaviors),
        possibleProtectiveFunction: firstString(record, ['possibleProtectiveFunction', 'protectiveFunction', 'sharedFunction']),
        familyInteractionChain: {
          parentTriggerAction: '',
          parentReasonableGoal: '帮助孩子进步',
          childReception: '感到压力或被评价',
          childReaction: mechanismName,
          parentSecondInterpretation: '孩子不配合',
          parentReinforcementAction: '加强管控或追问',
          childFurtherStrategy: '更强烈的防御',
          longTermEffect: '亲子信任下降，问题固化'
        },
        scores: defaultScores,
        overallStrength: normalizeStrength(record.overallStrength),
        applicableScope: firstString(record, ['applicableScope']) || '跨入口覆盖范围',
        missingEvidence: asStringArray(record.missingEvidence),
        possibleAlternativeExplanations: [],
        shouldPromoteToDiagnosis: record.shouldPromoteToDiagnosis !== false
      }
    })
    : buildFallbackMechanisms(packs, completedCount, defaultScores)

  const aiProfile = aiOutput?.childStructureModelDraft
  const aiHandoff = aiOutput?.diagnosisHandoffPackage

  const allFacts = packs.flatMap(p => p.decomposedInput.verifiableFacts)
  const allParentEvals = packs.flatMap(p => p.decomposedInput.parentEvaluations)
  const allMissing = packs.flatMap(p => p.decomposedInput.missingInformation)
  const allChildQuotes = packs.flatMap(p => p.decomposedInput.childQuotes)

  const suggestedMechanisms = mechanismMatrix
    .filter(m => m.shouldPromoteToDiagnosis)
    .map(m => m.mechanismName)

  return {
    agent: 'multi_entry_synthesis_modeling_agent',
    contextMaturityLevel: input.maturityLevel,
    inputCoverage,
    crossEntryEvidenceMap: crossEntryEvidence,
    candidateMechanismMatrix: mechanismMatrix,
    childStructureModelDraft: {
      primaryConditionalProfile: aiProfile?.primaryConditionalProfile || (
        completedCount >= 3 ? `基于${completedCount}个入口的交叉验证：${packs.map(p => p.rawInputSummary).join('；')}` : ''
      ),
      secondaryConditionalProfiles: aiProfile?.secondaryConditionalProfiles || [],
      dominantProtectiveStrategies: aiProfile?.dominantProtectiveStrategies || identifyProtectiveStrategies(packs.flatMap(p => p.decomposedInput.childBehaviors)),
      likelyFamilyInteractionPatterns: aiProfile?.likelyFamilyInteractionPatterns || identifyInteractionPatterns(
        packs.flatMap(p => p.decomposedInput.parentActions),
        packs.flatMap(p => p.decomposedInput.childBehaviors)
      ),
      learningSituationHypotheses: packs.filter(p => p.entryName === 'learning_homework').flatMap(p => p.handoffToSummaryAgent.mostLikelyLocalMechanisms),
      emotionalPressureHypotheses: packs.filter(p => p.entryName === 'emotional_stress').flatMap(p => p.handoffToSummaryAgent.mostLikelyLocalMechanisms),
      trustAndCommunicationHypotheses: packs.filter(p => p.entryName === 'parent_child_communication').flatMap(p => p.handoffToSummaryAgent.mostLikelyLocalMechanisms),
      boundaries: allMissing.slice(0, 5)
    },
    diagnosisHandoffPackage: {
      recommendedDiagnosisStrength: aiHandoff?.recommendedDiagnosisStrength as SynthesisOutput['diagnosisHandoffPackage']['recommendedDiagnosisStrength'] || (
        completedCount >= 5 ? 'core_profile' : completedCount >= 3 ? 'stage' : 'candidate'
      ) as SynthesisOutput['diagnosisHandoffPackage']['recommendedDiagnosisStrength'],
      mainMechanismToExplain: aiHandoff?.mainMechanismToExplain || suggestedMechanisms[0] || '',
      keyEvidencePath: aiHandoff?.keyEvidencePath || allFacts.slice(0, 5),
      parentMisreadingsToCorrect: aiHandoff?.parentMisreadingsToCorrect || allParentEvals.slice(0, 3),
      childPerspectiveToTranslate: aiHandoff?.childPerspectiveToTranslate || allChildQuotes.slice(0, 3),
      doNotOverstate: aiHandoff?.doNotOverstate || allMissing.slice(0, 3),
      mustKeepBoundary: aiHandoff?.mustKeepBoundary || (completedCount < 5 ? ['入口未全部完成，画像为阶段判断'] : []),
      stillNeedToVerify: aiHandoff?.stillNeedToVerify || allMissing.slice(0, 5)
    },
    memoryWriteSuggestions: {
      stableProfileCandidates: completedCount >= 5 ? suggestedMechanisms : [],
      stageJudgmentCandidates: suggestedMechanisms,
      pendingHypotheses: mechanismMatrix.filter(m => m.mechanismType === 'pending_hypothesis').map(m => m.mechanismName),
      familyInteractionCandidates: aiProfile?.likelyFamilyInteractionPatterns || identifyInteractionPatterns(
        packs.flatMap(p => p.decomposedInput.parentActions),
        packs.flatMap(p => p.decomposedInput.childBehaviors)
      ),
      factsToStore: allFacts.slice(0, 10),
      oldJudgmentsToUpdate: [],
      retrievalTags: suggestedMechanisms
    }
  }
}

function buildEmptyOutput(inputCoverage: Record<EntryName, 'missing' | 'partial' | 'sufficient' | 'strong'>): SynthesisOutput {
  return {
    agent: 'multi_entry_synthesis_modeling_agent',
    contextMaturityLevel: 'L0',
    inputCoverage,
    crossEntryEvidenceMap: [],
    candidateMechanismMatrix: [],
    childStructureModelDraft: {
      primaryConditionalProfile: '',
      secondaryConditionalProfiles: [],
      dominantProtectiveStrategies: [],
      likelyFamilyInteractionPatterns: [],
      learningSituationHypotheses: [],
      emotionalPressureHypotheses: [],
      trustAndCommunicationHypotheses: [],
      boundaries: ['当前无入口材料，无法综合建模']
    },
    diagnosisHandoffPackage: {
      recommendedDiagnosisStrength: 'direction',
      mainMechanismToExplain: '',
      keyEvidencePath: [],
      parentMisreadingsToCorrect: [],
      childPerspectiveToTranslate: [],
      doNotOverstate: [],
      mustKeepBoundary: ['信息不足，不能生成诊断'],
      stillNeedToVerify: []
    },
    memoryWriteSuggestions: {
      stableProfileCandidates: [],
      stageJudgmentCandidates: [],
      pendingHypotheses: [],
      familyInteractionCandidates: [],
      factsToStore: [],
      oldJudgmentsToUpdate: [],
      retrievalTags: []
    }
  }
}

function buildFallbackCrossEntry(packs: EntryEvidencePack[], completedCount: number): CrossEntryEvidence {
  const allBehaviors = packs.flatMap(p => p.decomposedInput.childBehaviors)
  const allParentActions = packs.flatMap(p => p.decomposedInput.parentActions)
  const allChildReactions = packs.flatMap(p => p.decomposedInput.childBehaviors)
  const allChildQuotes = packs.flatMap(p => p.decomposedInput.childQuotes)
  const allParentEvals = packs.flatMap(p => p.decomposedInput.parentEvaluations)

  return {
    evidenceId: createId('ev-cross'),
    sourceEntries: packs.map(p => p.entryName),
    surfaceBehaviors: allBehaviors.filter(Boolean),
    triggerPoints: packs.flatMap(p => p.decomposedInput.triggerPoints),
    parentActions: allParentActions.filter(Boolean),
    childReactions: allChildReactions.filter(Boolean),
    childQuotes: allChildQuotes.slice(0, 10),
    parentInterpretations: allParentEvals.slice(0, 5),
    possibleSharedFunction: identifySharedFunction(allBehaviors, allParentActions),
    evidenceStrength: completedCount >= 3 ? 'high' : 'medium',
    notes: completedCount < 5 ? `仅完成${completedCount}个入口，需继续采集` : '五入口已完成，可进入深层诊断'
  }
}

function buildFallbackMechanisms(packs: EntryEvidencePack[], completedCount: number, defaultScores: MechanismScore): CandidateMechanism[] {
  const allMechanisms = packs.flatMap(p => p.candidateMechanisms)
  if (allMechanisms.length === 0) return []
  return allMechanisms.slice(0, 5).map(m => ({
    mechanismName: m.mechanismName,
    mechanismType: (completedCount >= 5 && m.evidenceStrength === 'high' ? 'core_candidate' : 'stage_candidate') as 'core_candidate' | 'stage_candidate' | 'pending_hypothesis',
    description: m.description,
    supportedByEntries: packs.map(p => p.entryName),
    supportingEvidence: m.supportingEvidence,
    explainedBehaviors: [],
    possibleProtectiveFunction: m.possibleProtectiveFunction,
    familyInteractionChain: {
      parentTriggerAction: '',
      parentReasonableGoal: '帮助孩子进步',
      childReception: '感到压力或被评价',
      childReaction: m.mechanismName,
      parentSecondInterpretation: '孩子不配合',
      parentReinforcementAction: '加强管控或追问',
      childFurtherStrategy: '更强烈的防御',
      longTermEffect: '亲子信任下降，问题固化'
    },
    scores: defaultScores,
    overallStrength: m.evidenceStrength,
    applicableScope: '当前入口覆盖范围',
    missingEvidence: m.counterEvidenceOrGap,
    possibleAlternativeExplanations: [],
    shouldPromoteToDiagnosis: completedCount >= 3 && m.evidenceStrength !== 'low'
  }))
}

function identifySharedFunction(behaviors: string[], parentActions: string[]): string {
  const b = (behaviors.join('、') + parentActions.join('、')).toLowerCase()
  if (b.includes('拖延') && b.includes('手机')) return '用拖延保护休息边界，用手机争取可控时间'
  if (b.includes('沉默') && b.includes('关门')) return '用沉默和物理距离保护自己不被继续追问'
  if (b.includes('答应') && b.includes('拖')) return '表面配合降低当下冲突，实际拖延保留空间'
  if (b.includes('烦躁') && b.includes('检查')) return '用烦躁和回避应对反复暴露的检查压力'
  if (b.includes('接受') && b.includes('低')) return '对外部低评价支持保持开放，对内部高检查关系防御'
  return '维持表面和平，避免冲突进一步升级'
}

function identifyProtectiveStrategies(behaviors: string[]): string[] {
  const strategies: string[] = []
  const b = behaviors.join('、').toLowerCase()
  if (b.includes('拖延')) strategies.push('用拖延保护休息边界')
  if (b.includes('沉默')) strategies.push('用沉默避免被继续追问')
  if (b.includes('关门') || b.includes('走开')) strategies.push('用物理距离保护情绪空间')
  if (b.includes('答应')) strategies.push('用表面配合维持短暂和平')
  if (b.includes('手机')) strategies.push('用手机保留可控时间和恢复出口')
  if (b.includes('烦躁')) strategies.push('用烦躁表达拒绝被继续监督')
  return strategies.length > 0 ? strategies : ['待更多入口数据确认']
}

function identifyInteractionPatterns(parentActions: string[], childReactions: string[]): string[] {
  const patterns: string[] = []
  const pa = parentActions.join('、').toLowerCase()
  const cr = childReactions.join('、').toLowerCase()
  if (pa.includes('加') && cr.includes('拖')) patterns.push('任务加码—拖延自保循环')
  if (pa.includes('追问') && (cr.includes('沉默') || cr.includes('关门'))) patterns.push('追问—沉默循环')
  if (pa.includes('检查') && cr.includes('烦')) patterns.push('检查—暴露—回避循环')
  if (pa.includes('提醒') && cr.includes('答应')) patterns.push('提醒—表面配合—实际撤退循环')
  if (pa.includes('放手') && cr.includes('拖')) patterns.push('承诺放手—再次控制—孩子失望循环')
  return patterns.length > 0 ? patterns : ['待更多入口数据确认']
}

import type {
  DiagnosisOutput,
  DiagnosisTaskType,
  DiagnosisLevel,
  MaturityLevel,
  DiagnosisMechanismCandidate,
  PrimaryMechanismChain,
  ChildSelfProtection,
  DiagnosisInteractionLoop,
  MemoryHandoff,
  EvidenceStrength,
  SynthesisOutput
} from '@/types/database'
import { createId } from '@/lib/storage/storageIds'
import { callFastJson } from '@/lib/server/ark-agents'
import { buildProfileDiagnosisSystem } from '@/lib/server/profile-build-prompts'
import { sanitizeForParent } from '@/lib/server/daily/profile-sanitize'

/* ================================================================
   Diagnosis Pipeline — 深层诊断 Agent 编排
   调用 AI Agent 生成条件化画像和机制链
   ================================================================ */

export interface DiagnosisInput {
  taskType: DiagnosisTaskType
  maturityLevel: MaturityLevel
  surfaceProblem: string
  parentSurfaceJudgment: string
  synthesisOutput?: SynthesisOutput | null
  facts?: string[]
  childQuotes?: string[]
  parentQuotes?: string[]
  pendingHypotheses?: string[]
}

interface AiDiagnosisOutput {
  parentMisjudgmentCorrection: string
  secondMeConditionalProfile: string[] | string
  primaryMechanismChain: {
    parentAction: string
    childReception: string
    childProtectionStrategy: string
    parentSecondInterpretation: string
    reinforcingAction: string
    shortTermFunction: string
    longTermCost: string
  }
  childSelfProtection: {
    surfaceBehavior: string[]
    protectingWhat: string[]
    whyCannotExpressDirectly: string
    immatureButFunctionalStrategy: string
  }
  familyInteractionLoops: Array<{
    patternName: string
    loopSteps: string[]
    sceneScope: string
  }>
  needsFurtherVerification: string[]
  counterEvidenceNotes: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function normalizeMechanismChain(value: unknown): PrimaryMechanismChain | undefined {
  if (!isRecord(value)) return undefined
  return {
    parentAction: typeof value.parentAction === 'string' ? value.parentAction : '',
    childReception: typeof value.childReception === 'string' ? value.childReception : '',
    childProtectionStrategy: typeof value.childProtectionStrategy === 'string' ? value.childProtectionStrategy : '',
    parentSecondInterpretation: typeof value.parentSecondInterpretation === 'string' ? value.parentSecondInterpretation : '',
    reinforcingAction: typeof value.reinforcingAction === 'string' ? value.reinforcingAction : '',
    shortTermFunction: typeof value.shortTermFunction === 'string' ? value.shortTermFunction : '',
    longTermCost: typeof value.longTermCost === 'string' ? value.longTermCost : ''
  }
}

export async function runDiagnosisPipeline(input: DiagnosisInput): Promise<DiagnosisOutput> {
  const now = new Date().toISOString()
  const { taskType, maturityLevel } = input

  const synOutput = input.synthesisOutput
  const hasSynthesis = Boolean(synOutput?.candidateMechanismMatrix?.length)
  if (maturityLevel === 'L0' && !hasSynthesis) {
    return buildInsufficientOutput(maturityLevel, input)
  }

  const facts = input.facts || synOutput?.memoryWriteSuggestions?.factsToStore || []
  const handoff = synOutput?.diagnosisHandoffPackage

  // 暴露薄输入（不静默）：无 synthesisOutput → 机制/跨入口证据为空，诊断结构字段会偏薄。
  if (!hasSynthesis) console.warn('[diagnosis] 未收到 synthesisOutput：候选机制/跨入口证据为空，诊断深度受限')
  if (facts.length === 0) console.warn('[diagnosis] facts 为空：lowMisjudgmentFacts/crossSceneEvidencePaths 将为空')

  const mechanismSummaries = synOutput?.candidateMechanismMatrix?.map(m => ({
    name: m.mechanismName,
    strength: m.overallStrength,
    description: (m.description || '').slice(0, 160),
    evidence: (m.supportingEvidence || []).slice(0, 4),
    scope: m.applicableScope,
    protectiveFunction: m.possibleProtectiveFunction,
    chain: m.familyInteractionChain
      ? [
          m.familyInteractionChain.parentTriggerAction,
          m.familyInteractionChain.childReception,
          m.familyInteractionChain.childReaction,
        ]
          .filter(Boolean)
          .join('→')
      : undefined,
  })) || []

  const crossEntryEvidence = (synOutput?.crossEntryEvidenceMap || []).map(e => ({
    entries: e.sourceEntries,
    behaviors: e.surfaceBehaviors,
    sharedFunction: e.possibleSharedFunction,
    strength: e.evidenceStrength,
    triggers: e.triggerPoints,
    parentActions: e.parentActions,
    childReactions: e.childReactions,
  }))

  const interactionPatterns = synOutput?.childStructureModelDraft?.likelyFamilyInteractionPatterns || []
  const protectiveStrategies = synOutput?.childStructureModelDraft?.dominantProtectiveStrategies || []

  const handoffBlock = handoff
    ? {
        recommendedDiagnosisStrength: handoff.recommendedDiagnosisStrength,
        mainMechanismToExplain: handoff.mainMechanismToExplain,
        keyEvidencePath: handoff.keyEvidencePath || [],
        parentMisreadingsToCorrect: handoff.parentMisreadingsToCorrect || [],
        childPerspectiveToTranslate: handoff.childPerspectiveToTranslate || [],
        doNotOverstate: handoff.doNotOverstate || [],
        mustKeepBoundary: handoff.mustKeepBoundary || [],
        stillNeedToVerify: handoff.stillNeedToVerify || [],
      }
    : null

  const taskPrompt = `你是一个深层诊断 Agent。你已经有了综合建模的结果与诊断交接包，现在需要生成最终诊断。

输入材料：
- 诊断交接包（必读，勿忽略边界与待验证）：${JSON.stringify(handoffBlock)}
- 候选机制（含描述/证据/功能）：${JSON.stringify(mechanismSummaries)}
- 跨入口证据：${JSON.stringify(crossEntryEvidence)}
- 互动循环：${JSON.stringify(interactionPatterns)}
- 保护策略：${JSON.stringify(protectiveStrategies)}
- 家长表面判断："${input.parentSurfaceJudgment}"
- 表面问题："${input.surfaceProblem}"
- 可验证事实：${JSON.stringify(facts.slice(0, 32))}

你的核心任务：
1. 生成parentMisjudgmentCorrection：不是简单说"您错了"，而是用具体证据解释家长原有判断为什么太表面。优先用交接包 parentMisreadingsToCorrect + keyEvidencePath。
2. 生成secondMeConditionalProfile：条件化画像——"当X条件时，孩子更容易Y；这可能是因为A而不是B；在C情况下情况可能不同"。主线应对齐 mainMechanismToExplain。
3. 生成primaryMechanismChain：家长动作→孩子接收→孩子保护策略→家长二次解读→强化动作→短期功能→长期代价。
4. 生成familyInteractionLoops：至少3个具体的家庭互动循环。
5. 生成counterEvidenceNotes / needsFurtherVerification：必须吸收交接包 doNotOverstate、mustKeepBoundary、stillNeedToVerify——信息不够时明确边界，不要装成定论。

绝对禁止：
- 把"不自觉""没内驱力"写成孩子事实
- 停在"启动困难""评价敏感""压力较大"这些中间变量
- 输出"多鼓励少批评""制定计划"等通用建议
- 说"您把创伤投射给孩子"或任何创伤分析
- 说出"替代丈夫""父亲角色缺失"等后台术语
- 简化为"主要是您控制太多"或"主要是孩子自制力差"
- 忽略交接包里的 mustKeepBoundary / stillNeedToVerify

输出完整 JSON，所有字段必填。`;

  const aiResult = await callFastJson<AiDiagnosisOutput>(
    buildProfileDiagnosisSystem(),
    {
      task: taskPrompt,
      taskType,
      diagnosisHandoffPackage: handoffBlock,
      mechanismSummaries,
      crossEntryEvidence,
      interactionPatterns,
      protectiveStrategies,
      facts: facts.slice(0, 16),
      surfaceProblem: input.surfaceProblem,
      parentSurfaceJudgment: input.parentSurfaceJudgment,
    },
    // 首版画像的结构诊断保留完整 thinking，并给足输出空间承载机制链、循环与反证边界。
    { maxTokens: Number(process.env.FAST_AI_DIAGNOSIS_MAX_TOKENS || 8192) }
  ).catch(() => undefined as AiDiagnosisOutput | undefined)

  const ai = aiResult
  const aiConditionalProfiles = normalizeStringArray(ai?.secondMeConditionalProfile).map((p) =>
    sanitizeForParent(p)
  )
  const aiLoops = Array.isArray(ai?.familyInteractionLoops) ? ai.familyInteractionLoops : []
  const aiPrimaryChain = normalizeMechanismChain(ai?.primaryMechanismChain)

  const mechanismCandidates: DiagnosisMechanismCandidate[] = mechanismSummaries.map(m => ({
    mechanismName: m.name,
    description: m.name,
    supportingEvidence: m.evidence || [],
    explainsBehaviors: [],
    evidenceStrength: (m.strength === 'high' ? 'high' : 'medium') as EvidenceStrength,
    diagnosisLevel: (maturityLevel >= 'L3' ? 'core_profile' : 'stage') as DiagnosisLevel,
    missingEvidence: [],
    boundary: ''
  }))

  const primaryChain: PrimaryMechanismChain = aiPrimaryChain || {
    parentAction: handoff?.parentMisreadingsToCorrect?.[0] || '家长的合理教育动作',
    childReception: '孩子接收为压力或被评价',
    childProtectionStrategy: handoff?.childPerspectiveToTranslate?.[0] || '表面配合，实际撤退',
    parentSecondInterpretation: '家长认为孩子不配合、不自觉',
    reinforcingAction: '加强检查、追问或加码',
    shortTermFunction: '降低当下冲突，保护休息边界和自尊',
    longTermCost: '亲子信任下降，孩子更依赖隐蔽的防御策略'
  }

  const protection: ChildSelfProtection = isRecord(ai?.childSelfProtection) ? {
    surfaceBehavior: normalizeStringArray(ai.childSelfProtection.surfaceBehavior),
    protectingWhat: normalizeStringArray(ai.childSelfProtection.protectingWhat),
    whyCannotExpressDirectly: typeof ai.childSelfProtection.whyCannotExpressDirectly === 'string' ? ai.childSelfProtection.whyCannotExpressDirectly : '孩子在过去经验中发现，直接表达真实困难会带来更多讲道理、复盘、加任务或失望',
    immatureButFunctionalStrategy: typeof ai.childSelfProtection.immatureButFunctionalStrategy === 'string' ? ai.childSelfProtection.immatureButFunctionalStrategy : '用表面配合维持和平，用拖延保留可控空间'
  } : {
    surfaceBehavior: ['拖延', '表面答应', '回避检查'],
    protectingWhat: ['休息边界', '不暴露不会', '避免让家长失望'],
    whyCannotExpressDirectly: '孩子在过去经验中发现，直接表达真实困难会带来更多讲道理、复盘、加任务或失望',
    immatureButFunctionalStrategy: '用表面配合维持和平，用拖延保留可控空间'
  }

  const loops: DiagnosisInteractionLoop[] = (() => {
    // 只保留有实质内容的 AI 循环（有名字或有步骤）；LLM 返回空条目时回退到兜底循环，避免 familyInteractionLoop 空。
    const substantive = aiLoops.filter(l => (typeof l.patternName === 'string' && l.patternName.trim()) || (Array.isArray(l.loopSteps) && l.loopSteps.length > 0))
    if (substantive.length === 0) console.warn('[diagnosis] familyInteractionLoops 为空或字段缺失，使用兜底循环')
    return substantive.length > 0
      ? substantive.map(l => ({
          patternName: l.patternName || interactionPatterns[0] || '检查—暴露—回避循环',
          loopSteps: l.loopSteps && l.loopSteps.length > 0 ? l.loopSteps : ['家长检查进度', '孩子预期暴露未完成或不会', '孩子敷衍、隐瞒或烦躁', '家长认为态度差并加强检查', '孩子更强烈回避'],
          sceneScope: l.sceneScope || '家庭学习系统',
          evidence: facts.slice(0, 3),
          status: maturityLevel >= 'L4' ? 'stable' as const : 'stage' as const
        }))
      : [{
          patternName: interactionPatterns[0] || '检查—暴露—回避循环',
          loopSteps: ['家长检查进度', '孩子预期暴露未完成或不会', '孩子敷衍、隐瞒或烦躁', '家长认为态度差并加强检查', '孩子更强烈回避'],
          sceneScope: '学习任务系统',
          evidence: facts.slice(0, 3),
          status: maturityLevel >= 'L4' ? 'stable' as const : 'stage' as const
        }]
  })()

  const mainLoop = loops[0]

  const conditionalProfile = aiConditionalProfiles.join('\n\n') || buildConditionalProfile(input, facts, mechanismSummaries.map(m => m.name).join('、'))

  const parentCorrection = sanitizeForParent(
    ai?.parentMisjudgmentCorrection || buildParentCorrection(input, mechanismSummaries.map(m => m.name).join('、'))
  )

  const handoffToMemory: MemoryHandoff = {
    stableProfileCandidates: maturityLevel >= 'L3' ? [conditionalProfile] : [],
    stageJudgments: [conditionalProfile],
      pendingHypotheses: normalizeStringArray(ai?.needsFurtherVerification).length > 0 ? normalizeStringArray(ai?.needsFurtherVerification) : handoff?.stillNeedToVerify || [],
    evidenceToStore: facts,
    patternsToUpdate: loops.map(l => l.patternName).filter(Boolean)
  }

  return {
    diagnosisAgent: 'deep_diagnosis_agent',
    diagnosisTaskType: taskType,
    contextMaturityLevel: maturityLevel,
    surfaceProblem: input.surfaceProblem || '未指定表面问题',
    parentSurfaceJudgment: input.parentSurfaceJudgment || '未识别家长表层判断',
    lowMisjudgmentFacts: facts,
    crossSceneEvidencePaths: facts,
    mainMechanismCandidates: mechanismCandidates,
    primaryMechanismChain: primaryChain,
    childSelfProtection: protection,
    familyInteractionLoop: mainLoop,
    secondMeConditionalProfile: [conditionalProfile],
    parentMisjudgmentCorrection: parentCorrection,
    needsFurtherVerification: normalizeStringArray(ai?.needsFurtherVerification).length > 0 ? normalizeStringArray(ai?.needsFurtherVerification) : handoff?.stillNeedToVerify || [],
    handoffToMemoryAgent: handoffToMemory
  }
}

function buildInsufficientOutput(level: MaturityLevel, input: DiagnosisInput): DiagnosisOutput {
  return {
    diagnosisAgent: 'deep_diagnosis_agent',
    diagnosisTaskType: input.taskType,
    contextMaturityLevel: level,
    surfaceProblem: input.surfaceProblem || '',
    parentSurfaceJudgment: input.parentSurfaceJudgment || '',
    lowMisjudgmentFacts: [],
    crossSceneEvidencePaths: [],
    mainMechanismCandidates: [],
    primaryMechanismChain: {
      parentAction: '',
      childReception: '',
      childProtectionStrategy: '',
      parentSecondInterpretation: '',
      reinforcingAction: '',
      shortTermFunction: '',
      longTermCost: ''
    },
    childSelfProtection: {
      surfaceBehavior: [],
      protectingWhat: [],
      whyCannotExpressDirectly: '',
      immatureButFunctionalStrategy: ''
    },
    familyInteractionLoop: {
      patternName: '',
      loopSteps: [],
      sceneScope: '',
      evidence: [],
      status: 'candidate'
    },
    secondMeConditionalProfile: [],
    parentMisjudgmentCorrection: level === 'L0' ? '当前信息不足，无法生成深层诊断。建议先完成五入口采集。' : '当前仅完成部分入口，诊断为阶段判断，不宜作为稳定画像。',
    needsFurtherVerification: ['需要完成全部五入口采集', '需要多轮日常交互验证'],
    handoffToMemoryAgent: {
      stableProfileCandidates: [],
      stageJudgments: [],
      pendingHypotheses: [],
      evidenceToStore: [],
      patternsToUpdate: []
    }
  }
}

function buildConditionalProfile(input: DiagnosisInput, facts: string[], mechanism: string): string {
  const factSummary = facts.slice(0, 2).join('；')
  return `当${input.surfaceProblem || '学习任务进入被检查、被加码或可能暴露不会的'}场景出现时，孩子更容易先口头答应，再通过拖延、敷衍或手机把任务往后推。这可能不是因为孩子单纯不想学，而更像是因为${mechanism || '孩子已经把真实暴露和后续压力绑定在一起'}。${factSummary ? `这个判断主要来自${factSummary}。` : ''}学校独立任务中的表现还需要进一步验证。`
}

function buildParentCorrection(input: DiagnosisInput, mechanism: string): string {
  const judgment = input.parentSurfaceJudgment || '不自觉/骗/没内驱力'
  return `这件事不能再简单看成"${judgment}"。结合前面几类信息看，孩子现在不是不知道要学，也不是完全不想变好。更深一层看，${mechanism || '它可能已经不只是单次行为，而是一套在家庭互动中慢慢形成的应对策略'}。这不是替孩子开脱，而是要看清：如果继续按原有理解处理，可能会强化这个循环。`
}

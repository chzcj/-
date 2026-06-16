import { NextResponse } from 'next/server'
import { runSynthesisPipeline } from '@/lib/server/synthesis/pipeline'
import { buildSynthesisRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { runMemoryWritePipeline, buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'
import type { EntryEvidencePack, EntryName } from '@/types/database'

const LEGACY_TO_NEW: Record<string, EntryName> = {
  study: 'learning_homework',
  routine: 'daily_rhythm_phone',
  communication: 'parent_child_communication',
  emotion: 'emotional_stress',
  environment: 'relationship_environment',
}

function classifyFacts(facts: string[]): {
  childBehaviors: string[]; parentActions: string[]; triggerPoints: string[]; parentEvaluations: string[]
} {
  const childBehaviors: string[] = []
  const parentActions: string[] = []
  const triggerPoints: string[] = []
  const parentEvaluations: string[] = []
  const triggers = ['检查','抽查','提醒','催','问','被查','被问','要求','安排','布置','追加','被说']
  for (const f of facts) {
    const t = f.toLowerCase()
    const mentionsChild = t.includes('孩子')
    const mentionsParent = t.includes('家长') || t.includes('妈妈') || t.includes('母亲') || t.includes('爸爸')
    const mentionsTrigger = triggers.some(k => t.includes(k))

    if (mentionsChild || (!mentionsParent && !mentionsTrigger)) childBehaviors.push(f)
    if (mentionsParent) parentActions.push(f)
    if (mentionsTrigger) triggerPoints.push(f)
  }
  return { childBehaviors, parentActions, triggerPoints, parentEvaluations }
}

function buildEntryPack(
  legacyKey: string,
  data: { rawTexts: string[]; stageSummary?: string; followUps: string[]; aiFacts?: string[]; aiHypotheses?: string[] },
  familyId: string,
  childId: string,
  index: number,
): EntryEvidencePack {
  const entryName = LEGACY_TO_NEW[legacyKey]
  const now = new Date().toISOString()
  const packId = `pack-${Date.now()}-${index}`
  const aiFacts = data.aiFacts || []
  const aiHypotheses = data.aiHypotheses || []
  const classified = classifyFacts(aiFacts)

  return {
    packId,
    familyId,
    childId,
    entryName: entryName || 'learning_homework',
    entryStatus: 'evidence_pack_ready' as const,
    rawInputSummary: data.stageSummary ? `${data.stageSummary} 原始描述：${data.rawTexts.join('；')}` : data.rawTexts.join('；'),
    decomposedInput: {
      verifiableFacts: aiFacts.length > 0 ? aiFacts : data.rawTexts,
      childBehaviors: classified.childBehaviors,
      childQuotes: [],
      parentQuotes: data.rawTexts,
      parentActions: classified.parentActions,
      triggerPoints: classified.triggerPoints,
      timePlacePeople: [],
      parentEmotions: [],
      parentEvaluations: classified.parentEvaluations,
      parentAssumptions: [],
      parentGoals: [],
      backgroundFactors: [],
      missingInformation: aiHypotheses,
    },
    candidateMechanisms: data.stageSummary ? [{
      mechanismName: `${legacyKey}_local_hypothesis`,
      description: data.stageSummary,
      supportingEvidence: data.rawTexts,
      evidenceStrength: 'medium' as const,
      counterEvidenceOrGap: [],
      needsCrossEntryVerification: true,
      possibleProtectiveFunction: '',
      doNotPromoteToStableProfileYet: true,
    }] : [],
    evidenceUnits: [],
    followupCandidates: [],
    crossEntrySignals: [],
    handoffToSummaryAgent: {
      mostImportantEvidence: data.rawTexts,
      mostLikelyLocalMechanisms: data.stageSummary ? [data.stageSummary] : [],
      mostImportantGaps: aiHypotheses,
      possibleLinksToOtherEntries: [],
      warnings: [],
    },
    alreadyAskedQuestions: data.followUps.map((_, i) => `followup_${i}`),
    createdAt: now,
    updatedAt: now,
  }
}

export async function POST(request: Request) {
  if (!verifyInternalApi(request)) return authError()

  try {
    const body = await request.json()
    const {
      entryPacks,
      entryMap,
      maturityLevel = 'L2',
    } = body

    const tenant = await resolveTenant({
      familyId: (body as { familyId?: string }).familyId || 'f_demo',
      childId: (body as { childId?: string }).childId || 'c_demo'
    })
    const { familyId, childId } = tenant

    const retrievalPacket = await buildSynthesisRetrievalPacket(tenant)

    let packs: EntryEvidencePack[]
    if (entryPacks && (entryPacks as EntryEvidencePack[]).length > 0) {
      packs = entryPacks as EntryEvidencePack[]
    } else if (entryMap) {
      packs = Object.entries(entryMap as Record<string, { rawTexts: string[]; stageSummary?: string; followUps: string[]; aiFacts?: string[]; aiHypotheses?: string[] }>)
        .filter(([, data]) => data.rawTexts.length > 0 || (data.aiFacts?.length || 0) > 0)
        .map(([key, data], idx) => buildEntryPack(key, data, familyId, childId, idx))
    } else {
      packs = retrievalPacket.entryEvidencePacks
    }

    const output = await runSynthesisPipeline({
      maturityLevel,
      entryPacks: packs,
      existingNetwork: retrievalPacket.existingEvidenceNetwork
    })

    const writePlan = buildMemoryWritePlan({
      tenant,
      crossEntryNetwork: { networkData: output },
      pendingHypotheses: output.memoryWriteSuggestions.pendingHypotheses.map((h, i) => ({
        hypothesisId: `hyp-${Date.now()}-${i}`,
        familyId,
        childId,
        hypothesis: h,
        triggerSource: 'synthesis',
        supportingEvidence: [],
        missingEvidence: output.diagnosisHandoffPackage.stillNeedToVerify,
        verificationQuestions: [],
        possibleCounterEvidence: [],
        weight: 'medium' as const,
        applicableScenes: [],
        status: 'pending' as const,
        retrievalTags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      rationale: {
        whyUpdate: '多入口综合建模完成',
        whyNotPromoteSomeItems: output.diagnosisHandoffPackage.recommendedDiagnosisStrength === 'stage' ? '部分入口未完成' : '',
        riskOfOvergeneralization: '',
        nextVerificationNeed: output.diagnosisHandoffPackage.stillNeedToVerify.join('；')
      }
    })

    // 后台记忆写入异步执行，不阻塞画像生成返回（交付文档 6.3）。
    // 输出 synthesis 是画像生成管线所需，由 profile/generating 深度消费，故保留完整结构。
    void runMemoryWritePipeline(writePlan, tenant).catch((err) => {
      console.error('[synthesis] 后台记忆写入失败:', err)
    })

    return NextResponse.json({
      ok: true,
      data: {
        synthesis: output
      }
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'SYNTHESIS_ERROR', message: String(error) }
    }, { status: 500 })
  }
}

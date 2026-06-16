import { NextResponse } from 'next/server'
import { runDiagnosisPipeline } from '@/lib/server/diagnosis/pipeline'
import { runMemoryWritePipeline, buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { buildDiagnosisRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'
import type { DiagnosisTaskType, MaturityLevel, SynthesisOutput } from '@/types/database'

const maturityLevels: MaturityLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4']

function isMaturityLevel(value: unknown): value is MaturityLevel {
  return typeof value === 'string' && maturityLevels.includes(value as MaturityLevel)
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

export async function POST(request: Request) {
  if (!verifyInternalApi(request)) return authError()

  try {
    const body = await request.json()
    const {
      taskType = 'initial_model' as DiagnosisTaskType,
      surfaceProblem = '',
      parentSurfaceJudgment = '',
      facts = [],
      childQuotes = [],
      parentQuotes = [],
      pendingHypotheses = [],
      maturityLevel,
      synthesisOutput,
    } = body as {
      taskType?: DiagnosisTaskType
      surfaceProblem?: string
      parentSurfaceJudgment?: string
      facts?: unknown
      childQuotes?: unknown
      parentQuotes?: unknown
      pendingHypotheses?: unknown
      maturityLevel?: unknown
      synthesisOutput?: SynthesisOutput
      familyId?: string
      childId?: string
    }

    const tenant = await resolveTenant({
      familyId: (body as { familyId?: string }).familyId || 'f_demo',
      childId: (body as { childId?: string }).childId || 'c_demo'
    })
    const { familyId, childId } = tenant

    const retrievalPacket = await buildDiagnosisRetrievalPacket(tenant)
    const incomingFacts = asStringArray(facts)
    const incomingChildQuotes = asStringArray(childQuotes)
    const incomingParentQuotes = asStringArray(parentQuotes)
    const incomingPendingHypotheses = asStringArray(pendingHypotheses)
    const resolvedMaturityLevel = isMaturityLevel(maturityLevel)
      ? maturityLevel
      : synthesisOutput?.contextMaturityLevel || retrievalPacket.contextMaturityLevel

    const output = await runDiagnosisPipeline({
      taskType,
      maturityLevel: resolvedMaturityLevel,
      surfaceProblem: surfaceProblem || '未指定表面问题',
      parentSurfaceJudgment: parentSurfaceJudgment || '未识别家长表层判断',
      synthesisOutput,
      facts: incomingFacts.length > 0 ? incomingFacts : retrievalPacket.highStrengthEvidence,
      childQuotes: incomingChildQuotes.length > 0 ? incomingChildQuotes : retrievalPacket.childQuotes,
      parentQuotes: incomingParentQuotes.length > 0 ? incomingParentQuotes : retrievalPacket.parentQuotes,
      pendingHypotheses: incomingPendingHypotheses.length > 0 ? incomingPendingHypotheses : retrievalPacket.pendingBoundaries
    })

    const writePlan = buildMemoryWritePlan({
      tenant,
      diagnosisOutput: output,
      conditionalProfiles: output.secondMeConditionalProfile.map((cp, i) => ({
        profileId: `prof-${Date.now()}-${i}`,
        familyId,
        childId,
        status: 'stage_judgment' as const,
        triggerScene: '',
        childTendency: cp,
        notBecause: '',
        likelyBecause: '',
        parentInterventionEffect: '',
        protectiveStrategy: '',
        evidenceSources: [],
        strength: 'medium' as const,
        boundaries: output.needsFurtherVerification,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      pendingHypotheses: output.handoffToMemoryAgent.pendingHypotheses.map((h, i) => ({
        hypothesisId: `hyp-${Date.now()}-${i}`,
        familyId,
        childId,
        hypothesis: h,
        triggerSource: 'diagnosis',
        supportingEvidence: output.crossSceneEvidencePaths,
        missingEvidence: output.needsFurtherVerification,
        verificationQuestions: [],
        possibleCounterEvidence: [],
        weight: 'medium_high' as const,
        applicableScenes: [],
        status: 'pending' as const,
        retrievalTags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      rationale: {
        whyUpdate: '深层诊断完成',
        whyNotPromoteSomeItems: '',
        riskOfOvergeneralization: '',
        nextVerificationNeed: output.needsFurtherVerification.join('；')
      }
    })

    // 后台记忆写入异步执行，不阻塞画像生成返回（交付文档 6.3）。
    // 输出 diagnosis 是画像生成管线所需，由 profile/generating 深度消费，故保留完整结构。
    void runMemoryWritePipeline(writePlan, tenant).catch((err) => {
      console.error('[diagnosis] 后台记忆写入失败:', err)
    })

    return NextResponse.json({
      ok: true,
      data: {
        diagnosis: output
      }
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'DIAGNOSIS_ERROR', message: String(error) }
    }, { status: 500 })
  }
}

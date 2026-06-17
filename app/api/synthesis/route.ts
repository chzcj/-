import { NextResponse } from 'next/server'
import { runSynthesisPipeline } from '@/lib/server/synthesis/pipeline'
import { buildSynthesisRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { createId } from '@/lib/storage/storageIds'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'
import { buildEntryPack } from '@/lib/server/memory/entry-builder'
import type { EntryEvidencePack } from '@/types/database'

export async function POST(request: Request) {
  if (!verifyInternalApi(request)) return authError()

  try {
    const body = await request.json()
    const {
      entryPacks,
      entryMap,
      maturityLevel = 'L2',
      crossCuttingSupplement,
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
      existingNetwork: retrievalPacket.existingEvidenceNetwork,
      crossCuttingSupplement: typeof crossCuttingSupplement === 'string' ? crossCuttingSupplement.trim() : undefined
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

    // 后台记忆写入入队（可靠重试）。输出 synthesis 是画像生成管线所需，由 profile/generating 深度消费，故保留完整结构。
    void enqueueJob('memory_write', { plan: writePlan, tenant }, null, createId('trace'))

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

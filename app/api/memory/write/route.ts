import { NextResponse } from 'next/server'
import { runMemoryWritePipeline, buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate, classifyInputForMemory } from '@/lib/server/memory/write/decision-engine'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { createId } from '@/lib/storage/storageIds'
import type { RawMaterial, CleanedFact } from '@/types/database'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const body = await request.json()
    const {
      rawMaterials = [],
      cleanedFacts = [],
      entryEvidencePacks = [],
      newInput = ''
    } = body

    // 会话身份为准（无会话回落 f_demo），忽略 body 的 familyId/childId——杜绝内部 token 路径下借 body 越权写他人租户。
    const tenant = await resolveTenant()

    // 前端（五入口 summary 页）传的 rawMaterials/cleanedFacts 是 string[]，
    // 而后端按 RawMaterial[]/CleanedFact[] 处理——直接透传会产生 materialId/factId=undefined
    // 的检索索引（indexId 恒定互相覆盖、无法回链原始材料）。这里把字符串项规整为合法对象。
    const nowIso = new Date().toISOString()
    const normalizedRawMaterials: RawMaterial[] = (rawMaterials as unknown[]).map((m) =>
      typeof m === 'string'
        ? { materialId: createId('raw'), familyId: tenant.familyId, childId: tenant.childId, source: 'text', rawText: m, speaker: 'parent', timestamp: nowIso, createdAt: nowIso }
        : (m as RawMaterial)
    )
    const normalizedCleanedFacts: CleanedFact[] = (cleanedFacts as unknown[]).map((f) =>
      typeof f === 'string'
        ? { factId: createId('fact'), familyId: tenant.familyId, childId: tenant.childId, sourceRawIds: [], scene: '', event: f, parentEvaluation: '', evidenceStrength: 'low', missingInfo: [], crossEntrySignals: [], createdAt: nowIso, updatedAt: nowIso }
        : (f as CleanedFact)
    )

    const classification = classifyInputForMemory(newInput, [], false)
    const dailyUpdate = createDailyUpdate(newInput, classification, [], tenant)

    const writePlan = buildMemoryWritePlan({
      tenant,
      rawMaterials: normalizedRawMaterials,
      cleanedFacts: normalizedCleanedFacts,
      entryEvidencePacks,
      dailyUpdates: [dailyUpdate],
      rationale: {
        whyUpdate: '新记忆材料写入',
        whyNotPromoteSomeItems: '',
        riskOfOvergeneralization: '',
        nextVerificationNeed: ''
      }
    })

    const result = await runMemoryWritePipeline(writePlan, tenant)

    return NextResponse.json({
      ok: result.ok,
      data: { written: result.written, classification }
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'MEMORY_WRITE_ERROR', message: String(error) }
    }, { status: 500 })
  }
}

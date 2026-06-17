import { NextResponse } from 'next/server'
import { runMemoryWritePipeline, buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate, classifyInputForMemory } from '@/lib/server/memory/write/decision-engine'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'

export async function POST(request: Request) {
  if (!verifyAppApi(request)) return authError()

  try {
    const body = await request.json()
    const {
      rawMaterials = [],
      cleanedFacts = [],
      entryEvidencePacks = [],
      newInput = ''
    } = body

    const tenant = await resolveTenant({
      familyId: (body as { familyId?: string }).familyId || 'f_demo',
      childId: (body as { childId?: string }).childId || 'c_demo'
    })

    const classification = classifyInputForMemory(newInput, [], false)
    const dailyUpdate = createDailyUpdate(newInput, classification, [], tenant)

    const writePlan = buildMemoryWritePlan({
      tenant,
      rawMaterials,
      cleanedFacts,
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

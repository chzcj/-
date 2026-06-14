import { NextResponse } from 'next/server'
import { runMemoryWritePipeline, buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate, classifyInputForMemory } from '@/lib/server/memory/write/decision-engine'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'

export async function POST(request: Request) {
  if (!verifyInternalApi(request)) return authError()

  try {
    const body = await request.json()
    const {
      rawMaterials = [],
      cleanedFacts = [],
      entryEvidencePacks = [],
      newInput = ''
    } = body

    const classification = classifyInputForMemory(newInput, [], false)
    const dailyUpdate = createDailyUpdate(newInput, classification, [])

    const writePlan = buildMemoryWritePlan({
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

    const result = await runMemoryWritePipeline(writePlan)

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

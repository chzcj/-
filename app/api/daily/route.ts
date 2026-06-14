import { NextResponse } from 'next/server'
import { runOrchestrationPipeline } from '@/lib/server/orchestration/pipeline'
import { runMemoryWritePipeline, buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'

export async function POST(request: Request) {
  if (!verifyInternalApi(request)) return authError()

  try {
    const body = await request.json()
    const { text = '', maturityLevel } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message: '请输入内容' }
      }, { status: 400 })
    }

    const output = await runOrchestrationPipeline({
      userText: text.trim(),
      maturityLevel
    })

    const writePlan = buildMemoryWritePlan({
      dailyUpdates: [createDailyUpdate(
        text.trim(),
        output.relationshipToExistingModel.type,
        output.retrievedContext.relevantEntryEvidencePacks
      )],
      rationale: {
        whyUpdate: '日常对话调度完成',
        whyNotPromoteSomeItems: output.routingDecision.frontResponseType === 'light_response' ? '轻回应，不升级为长期判断' : '',
        riskOfOvergeneralization: '',
        nextVerificationNeed: output.routingDecision.needFollowup ? output.routingDecision.followupQuestion : ''
      }
    })

    const writeResult = await runMemoryWritePipeline(writePlan)

    return NextResponse.json({
      ok: true,
      data: {
        orchestration: output,
        memoryWrite: writeResult
      }
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'DAILY_ERROR', message: String(error) }
    }, { status: 500 })
  }
}

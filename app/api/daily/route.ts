import { NextResponse } from 'next/server'
import { runOrchestrationPipeline, deriveLinkedAreas, buildDailyCards } from '@/lib/server/orchestration/pipeline'
import { buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { createId } from '@/lib/storage/storageIds'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const body = await request.json()
    const { text = '', maturityLevel } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message: '请输入内容' }
      }, { status: 400 })
    }

    const userText = text.trim()
    const traceId = createId('trace')
    const tenant = await resolveTenant()

    const output = await runOrchestrationPipeline({
      userText,
      maturityLevel,
      tenant
    })

    // 前台只暴露家长可见信息：回复正文 + 关联领域名。
    // 内部判断字段（routingDecision / memoryAction 等）不出前台（交付文档 6.5 / 11.2 / 13.3 P0）。
    const visibleReply = output.frontResponseDraft
    const linkedAreas = deriveLinkedAreas(userText)
    // 家长可读卡片（交付文档 4.5）：与 stream 路由对齐，安全回复不挂卡片。
    const cards = output.relationshipToExistingModel.type === 'safety' ? {} : buildDailyCards(output)

    // 后台记忆写入异步执行，不阻塞前台回复（交付文档 6.3 / 12.4）。
    // 写入失败只记录日志、不影响前台返回；重试机制由后续 job_queue 改进承接。
    const writePlan = buildMemoryWritePlan({
      tenant,
      dailyUpdates: [createDailyUpdate(
        userText,
        output.relationshipToExistingModel.type,
        output.retrievedContext.matchedMechanisms,
        tenant,
        traceId
      )],
      rationale: {
        whyUpdate: '日常对话调度完成',
        whyNotPromoteSomeItems: output.routingDecision.frontResponseType === 'light_response' ? '轻回应，不升级为长期判断' : '',
        riskOfOvergeneralization: '',
        nextVerificationNeed: output.routingDecision.needFollowup ? output.routingDecision.followupQuestion : ''
      }
    })

    // 后台记忆写入入队（可靠重试，文档 14.3）。plan 内 itemId 已固定 → executeWritePlan 幂等，无需去重键。
    void enqueueJob('memory_write', { plan: writePlan, tenant }, null, traceId)

    // 日常深拆（Layer 2）：异步六维拆解 + 保守生成新假设 → memory_write → model_review。幂等键按 (tenant + sha(text)) 派生。
    void enqueueJob('daily_deep', { text: userText, tenant, traceId }, `daily_deep_${deriveEpisodeId(userText, { familyId: tenant.familyId, childId: tenant.childId })}`, traceId)

    return NextResponse.json({
      ok: true,
      data: {
        traceId,
        visibleReply,
        linkedAreas,
        cards
      }
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'DAILY_ERROR', message: String(error) }
    }, { status: 500 })
  }
}

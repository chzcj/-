import { ok, fail, failFromError } from '@/lib/api-response'
/** @deprecated 请使用 POST /api/daily/stream — 本路由仅保留兼容，逻辑已对齐 stream（L1 optional + 不触发 daily_deep） */
import { buildTurnEvent } from '@/lib/server/orchestration/pipeline'
import { runDailyTurnBff } from '@/lib/server/daily/daily-turn-bff'
import { buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { saveTurnEvent } from '@/lib/server/memory/database-manager'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { createId } from '@/lib/storage/storageIds'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const body = await request.json()
    const { text = '', maturityLevel, recentSectionIds: rawRecent } = body
    const recentSectionIds = Array.isArray(rawRecent)
      ? rawRecent.filter((id: unknown) => typeof id === 'string')
      : []

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return fail('EMPTY_INPUT', '请输入内容', undefined, 400)
    }

    const userText = text.trim()
    const traceId = createId('trace')
    const tenant = await resolveTenant()

    const result = await runDailyTurnBff({ userText, maturityLevel, tenant, traceId, recentSectionIds })

    // L1 optional：与 /api/daily/stream 一致，insufficient / safety 跳过 L1 写入；L0 TurnEvent 仍总写。
    const relType = result.output.relationshipToExistingModel.type
    const shouldWriteL1 = !result.isSafety && relType !== 'insufficient'
    if (shouldWriteL1) {
      const writePlan = buildMemoryWritePlan({
        tenant,
        dailyUpdates: [createDailyUpdate(
          userText,
          relType,
          result.output.retrievedContext.matchedMechanisms,
          tenant,
          traceId
        )],
        rationale: {
          whyUpdate: '日常对话调度完成',
          whyNotPromoteSomeItems: result.output.routingDecision.frontResponseType === 'light_response' ? '轻回应，不升级为长期判断' : '',
          riskOfOvergeneralization: '',
          nextVerificationNeed: result.output.routingDecision.needFollowup ? result.output.routingDecision.followupQuestion : ''
        }
      })
      void enqueueJob('memory_write', { plan: writePlan, tenant }, null, traceId)
    }

    void saveTurnEvent(tenant, buildTurnEvent({
      output: result.output,
      traceId,
      tenant,
      userMessage: userText,
      assistantReply: result.finalText,
      linkedAreas: result.linkedAreas,
      sections: result.sections,
      actions: result.actions,
    })).catch((err) => console.error(`[daily] TurnEvent 快照写入失败 traceId=${traceId}:`, err))

    return ok({
      traceId,
      visibleReply: result.finalText,
      linkedAreas: result.linkedAreas,
      cards: result.cards,
      sections: result.sections,
      actions: result.actions,
    })
  } catch (error) {
    return failFromError(error)
  }
}

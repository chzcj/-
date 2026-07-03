import { runDailyTurnBff } from '@/lib/server/daily/daily-turn-bff'
import { buildThinkingChips } from '@/lib/server/daily/thinking-chips'
import { buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { saveTurnEvent } from '@/lib/server/memory/database-manager'
import { buildTurnEvent } from '@/lib/server/orchestration/pipeline'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { fail } from '@/lib/api-response'
import { DailyLlmRequiredError } from '@/lib/server/daily/llm-required'
import { createId } from '@/lib/storage/storageIds'

const THINKING_THRESHOLD_MS = 1500

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const maturityLevel = (body as { maturityLevel?: unknown })?.maturityLevel
  const recentSectionIds = Array.isArray((body as { recentSectionIds?: unknown }).recentSectionIds)
    ? ((body as { recentSectionIds: unknown[] }).recentSectionIds.filter((id) => typeof id === 'string') as string[])
    : []

  if (!text) {
    return fail('EMPTY_INPUT', '请输入内容', undefined, 400)
  }

  const traceId = createId('trace')
  const encoder = new TextEncoder()
  const tenant = await resolveTenant()

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        const t0 = Date.now()
        let thinkingSent = false
        let thinkingTimer: ReturnType<typeof setTimeout> | undefined

        const sendThinking = (output: Parameters<typeof buildThinkingChips>[0]) => {
          if (thinkingSent) return
          thinkingSent = true
          send({ type: 'thinking', chips: buildThinkingChips(output) })
        }

        try {
          send({ type: 'start', traceId })

          const result = await runDailyTurnBff({
            userText: text,
            maturityLevel: maturityLevel as never,
            tenant,
            traceId,
            recentSectionIds,
            onDelta: (delta) => {
              if (thinkingTimer) {
                clearTimeout(thinkingTimer)
                thinkingTimer = undefined
              }
              send({ type: 'delta', delta })
            },
          })

          if (Date.now() - t0 >= THINKING_THRESHOLD_MS) {
            sendThinking(result.output)
          } else {
            thinkingTimer = setTimeout(() => sendThinking(result.output), THINKING_THRESHOLD_MS - (Date.now() - t0))
          }

          if (thinkingTimer) {
            clearTimeout(thinkingTimer)
            thinkingTimer = undefined
          }

          send({
            type: 'final',
            text: result.finalText,
            sections: result.sections,
            actions: result.actions,
            linkedAreas: result.linkedAreas,
            cards: result.cards,
            traceId,
            runtime: result.runtime,
          })

          await saveTurnEvent(tenant, buildTurnEvent({
            output: result.output,
            traceId,
            tenant,
            userMessage: text,
            assistantReply: result.finalText,
            linkedAreas: result.linkedAreas,
            sections: result.sections,
            actions: result.actions,
          })).catch((err) => {
            console.error(`[daily/stream] TurnEvent 快照写入失败 traceId=${traceId}:`, err)
          })

          // L1 optional：编排判定「值得记」才写 memory_write（dailyInteractionUpdate + 检索索引）。
          // L0 turn_event 已无条件写入（上文 saveTurnEvent）。insufficient（信息不足）与 safety 跳过 L1，
          // 避免无信息轮次膨胀 memory_layer_items 检索池。L2 episode/L3 结构由深度展开/任务/建模触发。
          const relType = result.output.relationshipToExistingModel.type
          const shouldWriteL1 = !result.isSafety && relType !== 'insufficient'
          if (shouldWriteL1) {
            const writePlan = buildMemoryWritePlan({
              tenant,
              dailyUpdates: [createDailyUpdate(
                text,
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

          // episode_ingest / daily_deep / model_review 不再在每条日常消息无条件入队。
          // episode 沉淀改为「深度展开」/「保存为今晚任务」时由对应接口主动触发（见 /api/daily/deep-expand、/api/tasks）。
          // model_review 改为 memory_write 链式（有假设时）+ 每租户每日桶频控（queue.ts）。
          // daily_deep 深拆能力并入 episode_ingest（episodeExtractor 扩展六维输出）。

          controller.close()
        } catch (error) {
          if (thinkingTimer) clearTimeout(thinkingTimer)
          console.error(`[daily/stream] traceId=${traceId}:`, error)
          const isLlm = error instanceof DailyLlmRequiredError
          send({
            type: 'error',
            code: isLlm ? 'LLM_REQUIRED' : 'STREAM_FAILED',
            message: isLlm
              ? 'AI 服务暂时不可用，请稍后再试。'
              : '这次没有整理成功，可以再试一次。',
          })
          controller.close()
        }
      }
    }),
    {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    }
  )
}

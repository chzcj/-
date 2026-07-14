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
import type { DailyStreamEvent } from '@/types/daily-stream'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const maturityLevel = (body as { maturityLevel?: unknown })?.maturityLevel
  const warmTurn = (body as { warmTurn?: unknown })?.warmTurn === true
  const recentSectionIds = Array.isArray((body as { recentSectionIds?: unknown }).recentSectionIds)
    ? ((body as { recentSectionIds: unknown[] }).recentSectionIds.filter((id) => typeof id === 'string') as string[])
    : []

  if (!text) {
    return fail('EMPTY_INPUT', '请输入内容', undefined, 400)
  }

  const traceId = createId('trace')
  const encoder = new TextEncoder()
  const tenant = await resolveTenant()
  const t0 = Date.now()
  let firstDeltaAt: number | null = null

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: DailyStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        let thinkingSent = false

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
            warmTurn,
            onOrchestration: (output) => sendThinking(output),
            onDelta: (delta) => {
              if (firstDeltaAt === null) firstDeltaAt = Date.now()
              send({ type: 'delta', delta })
            },
            onProseComplete: () => {
              send({ type: 'prose_complete' })
            },
            onSectionStart: (section) => {
              send({ type: 'section_start', section })
            },
            onSectionDelta: (id, text) => {
              send({ type: 'section_delta', id, text })
            },
            onSectionComplete: (section) => {
              send({ type: 'section_complete', section })
            },
            onSectionError: (id, message) => {
              send({ type: 'section_error', id, message: message || '这部分未生成' })
            },
            onSectionsComplete: (sections) => {
              send({ type: 'sections_complete', sections })
            },
            onSections: (sections) => {
              send({ type: 'sections', sections })
            },
            onActions: (actions) => {
              send({ type: 'actions', actions })
            },
          })

          send({
            type: 'final',
            text: result.finalText,
            sections: result.sections,
            actions: result.actions,
            linkedAreas: result.linkedAreas,
            cards: result.cards,
            traceId,
            runtime: result.runtime,
            timing: result.timing,
          })

          const totalMs = Date.now() - t0
          const ttftMs = firstDeltaAt ? firstDeltaAt - t0 : null
          console.info(
            `[daily/stream] traceId=${traceId} ttft=${ttftMs}ms orchestration=${result.timing.orchestrationMs}ms proseFirst=${result.timing.proseFirstMs}ms sections=${result.timing.sectionsMs}ms total=${totalMs}ms rel=${result.output.relationshipToExistingModel.type} warmTurn=${warmTurn}`
          )

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

          // L1 选择性写入（省 token，防每轮都写）：
          // - safety / insufficient：不写（已有 turn_event）
          // - light_response（轻回应/寒暄）且原文 < 12 字：不写
          // - 其余（有机制信号/反证/明确场景）：写 daily_update（便宜），memory_write 链式 digest/model_review
          const relType = result.output.relationshipToExistingModel.type
          const frontResponseType = result.output.routingDecision.frontResponseType
          const isLight = frontResponseType === 'light_response'
          const isShortGreeting = isLight && text.length < 12
          const shouldWriteL1 = !result.isSafety && relType !== 'insufficient' && !isShortGreeting
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
                whyNotPromoteSomeItems: isLight ? '轻回应，不升级为长期判断' : '',
                riskOfOvergeneralization: '',
                nextVerificationNeed: result.output.routingDecision.needFollowup ? result.output.routingDecision.followupQuestion : ''
              }
            })
            void enqueueJob('memory_write', { plan: writePlan, tenant }, null, traceId)
            // S2：有效交流轮计数；每 10 轮独立入队 deep_mechanism（与日桶正交）
            void import('@/lib/server/memory/deep-mechanism/note-effective-turn')
              .then(({ noteEffectiveFamilyTurn }) => noteEffectiveFamilyTurn(tenant, 'daily', traceId))
              .catch(() => {})
          }

          // episode 选择性触发（向量抽取贵，不每轮）：仅反证等高价值日常轮主动 ingest，
          // 让「刚聊的内容」尽快可被语义检索命中。深度展开/任务/采集另由对应接口触发。
          if (!result.isSafety && relType === 'counter_evidence') {
            void enqueueJob('episode_ingest', {
              text,
              ctx: { familyId: tenant.familyId, childId: tenant.childId, sourceEventId: traceId },
            }, null, traceId).catch(err => console.warn('[daily/stream] counter_evidence episode 入队失败:', err))
          }

          controller.close()
        } catch (error) {
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

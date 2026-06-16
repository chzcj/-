import { runOrchestrationPipeline } from '@/lib/server/orchestration/pipeline'
import { runMemoryWritePipeline, buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { ingestEpisode } from '@/lib/server/memory/episode/pipeline'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { callAgentTextStream } from '@/lib/server/ark-agents'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'
import { createId } from '@/lib/storage/storageIds'

/* ================================================================
   日常对话流式输出（交付文档 6.3 / 14.3）
   规则引擎做检索/判断/安全检测/降级文案；LLM 流式生成 visibleReply。
   无 AI key 或 LLM 失败时降级为规则文案，行为不退化。
   后台记忆写入异步，不阻塞前台（交付文档 6.3 / 12.4）。
   ================================================================ */

export async function POST(request: Request) {
  if (!verifyInternalApi(request)) return authError()

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const maturityLevel = (body as { maturityLevel?: unknown })?.maturityLevel

  if (!text) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'EMPTY_INPUT', message: '请输入内容' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const traceId = createId('trace')
  const encoder = new TextEncoder()
  // 在 POST 同步上下文解析租户（cookies() 合法），得到纯值供 stream 内与后台任务按值捕获。
  const tenant = await resolveTenant()

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))

        try {
          send({ type: 'start', traceId })

          // 规则引擎：检索 + 分类 + 安全检测 + 结构化判断 + 降级文案
          const output = await runOrchestrationPipeline({ userText: text, maturityLevel: maturityLevel as never, tenant })

          const linkedAreas = output.retrievedContext.relevantEntryEvidencePacks
            .map((pack) => (pack as { entryName?: string }).entryName)
            .filter((name): name is string => Boolean(name))

          const isSafety = output.relationshipToExistingModel.type === 'safety'
          let finalText = output.frontResponseDraft

          if (isSafety) {
            // 安全风险：直接用规则安全文案，不经过 LLM
            send({ type: 'delta', delta: finalText })
          } else {
            // 尝试 LLM 流式生成 visibleReply；无 key 或失败时降级为规则文案
            const streamed = await callAgentTextStream(
              'dailyDialogueOrchestration',
              '基于已掌握的家庭理解，对家长本轮输入生成一段自然、简洁、有上下文感的前台回复。只输出这段回复本身，不要输出 JSON、字段名或内部分类。',
              {
                userText: text,
                maturityLevel: output.contextMaturityLevel,
                retrievedUnderstanding: output.retrievedContext.relevantChildStructureModel,
                relatedEvidence: output.retrievedContext.relevantEntryEvidencePacks,
                pastEvents: output.retrievedContext.relevantPastEvents,
                pendingHypotheses: output.retrievedContext.relevantPendingHypotheses,
                suggestedResponseType: output.routingDecision.frontResponseType,
                suggestedFollowup: output.routingDecision.followupQuestion
              },
              (delta) => send({ type: 'delta', delta })
            ).catch((err) => {
              console.error(`[daily/stream] LLM 流式失败 traceId=${traceId}:`, err)
              return undefined
            })

            if (streamed && streamed.trim()) {
              finalText = streamed.trim()
            } else {
              // 降级：未启用 LLM 或失败，把规则文案作为一整块发出
              send({ type: 'delta', delta: finalText })
            }
          }

          send({ type: 'final', text: finalText, linkedAreas, traceId })

          // 后台记忆写入异步执行，不阻塞前台回复（交付文档 6.3 / 12.4）
          const writePlan = buildMemoryWritePlan({
            tenant,
            dailyUpdates: [createDailyUpdate(
              text,
              output.relationshipToExistingModel.type,
              output.retrievedContext.relevantEntryEvidencePacks,
              tenant
            )],
            rationale: {
              whyUpdate: '日常对话调度完成',
              whyNotPromoteSomeItems: output.routingDecision.frontResponseType === 'light_response' ? '轻回应，不升级为长期判断' : '',
              riskOfOvergeneralization: '',
              nextVerificationNeed: output.routingDecision.needFollowup ? output.routingDecision.followupQuestion : ''
            }
          })
          void runMemoryWritePipeline(writePlan, tenant).catch((err) => {
            console.error(`[daily/stream] 后台记忆写入失败 traceId=${traceId}:`, err)
          })

          // 后台抽取 EvidenceEpisode + FactAtom 并向量化（异步，不阻塞前台；内部已 try/catch）
          void ingestEpisode(text, { sourceEventId: traceId, familyId: tenant.familyId, childId: tenant.childId })

          controller.close()
        } catch (error) {
          send({ type: 'error', message: '这次没有整理成功，可以再试一次。', detail: String(error) })
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

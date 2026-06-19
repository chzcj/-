import { runOrchestrationPipeline, deriveLinkedAreas, buildDailyCards, buildTurnEvent } from '@/lib/server/orchestration/pipeline'
import { buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import { createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { enqueueJob, modelReviewBucketKey } from '@/lib/server/jobs/queue'
import { saveTurnEvent } from '@/lib/server/memory/database-manager'
import { callAgentTextStream } from '@/lib/server/ark-agents'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { fail } from '@/lib/api-response'
import { createId } from '@/lib/storage/storageIds'
import type { KnowledgeContext } from '@/types/database'

/* ================================================================
   日常对话流式输出（交付文档 6.3 / 14.3）
   规则引擎做检索/判断/安全检测/降级文案；LLM 流式生成 visibleReply。
   无 AI key 或 LLM 失败时降级为规则文案，行为不退化。
   后台记忆写入异步，不阻塞前台（交付文档 6.3 / 12.4）。
   ================================================================ */

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const maturityLevel = (body as { maturityLevel?: unknown })?.maturityLevel

  if (!text) {
    return fail('EMPTY_INPUT', '请输入内容', undefined, 400)
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

          const linkedAreas = deriveLinkedAreas(text)

          const isSafety = output.relationshipToExistingModel.type === 'safety'
          // 家长可读卡片（交付文档 4.5）：同步纯函数装配，零额外 LLM、不阻塞。安全回复不挂分析卡。
          const cards = isSafety ? {} : buildDailyCards(output)
          let finalText = output.frontResponseDraft

          if (isSafety) {
            // 安全风险：直接用规则安全文案，不经过 LLM
            send({ type: 'delta', delta: finalText })
          } else {
            // 尝试 LLM 流式生成 visibleReply；无 key 或失败时降级为规则文案
            const streamed = await callAgentTextStream(
              'dailyDialogueOrchestration',
              '基于已掌握的家庭理解，对家长本轮输入生成一段自然、简洁、有上下文感的前台回复。只输出这段回复本身，不要输出 JSON、字段名或内部分类。如果需要提关键追问，必须先用一句话说明"这里想区分 X 还是 Y"再问，每轮最多一个问题。',
              {
                userText: text,
                maturityLevel: output.contextMaturityLevel,
                retrievedUnderstanding: output.retrievedContext.relevantChildStructureModel,
                relatedEvidence: output.retrievedContext.relevantEntryEvidencePacks,
                pastEvents: output.retrievedContext.relevantPastEvents,
                pendingHypotheses: output.retrievedContext.relevantPendingHypotheses,
                suggestedResponseType: output.routingDecision.frontResponseType,
                suggestedFollowup: output.routingDecision.followupQuestion,
                // 知识库预留（交付文档 9.2）：P0 恒空，字段预留供后续挂载，不替代家庭事实。
                knowledgeContext: undefined as KnowledgeContext | undefined
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

          send({ type: 'final', text: finalText, linkedAreas, cards, traceId })

          // TurnEvent 输入快照（交付文档 7.2）：fire-and-forget，置于回复发出后，零阻塞。
          // 按 traceId 持久化「喂给 Agent 的上下文 + Agent 产出」，供 13.1 可复现审计。
          void saveTurnEvent(tenant, buildTurnEvent({
            output, traceId, tenant, userMessage: text, assistantReply: finalText, linkedAreas
          })).catch((err) => console.error(`[daily/stream] TurnEvent 快照写入失败 traceId=${traceId}:`, err))

          // 后台记忆写入异步执行，不阻塞前台回复（交付文档 6.3 / 12.4）。
          // 注意：daily 流只写 L9 dailyUpdate，不写 L1(RawMaterial)/L2(CleanedFact)——这是已决策的架构演进：
          // 事实权威层由下方 ingestEpisode 的 EvidenceEpisode + FactAtom 承担（FactAtom 的 sourceType 已把"事实 vs 评价"分层，
          // 等价并细化了 L2，且向量化可语义检索）。不双写 L1/L2，避免事实冗余与检索去重负担。
          const writePlan = buildMemoryWritePlan({
            tenant,
            dailyUpdates: [createDailyUpdate(
              text,
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
          void enqueueJob('memory_write', { plan: writePlan, tenant }, null, traceId)

          // Episode 抽取入队：episodeId 按 (tenant + sha(text)) 派生作幂等键，去重双提交 + 重试不重复建。
          const episodeId = deriveEpisodeId(text, { familyId: tenant.familyId, childId: tenant.childId })
          void enqueueJob('episode_ingest', {
            text,
            ctx: { sourceEventId: traceId, familyId: tenant.familyId, childId: tenant.childId, episodeId }
          }, episodeId, traceId)

          // 定期重评（P2 异步循环）：日常新证据落库后按 10 分钟桶触发模型复核，让待验证假设随使用持续被反证/加权。
          // 桶幂等键限流，无活跃假设时 runModelReview 提前 no-op，不空跑 LLM。
          void enqueueJob('model_review', { tenant }, modelReviewBucketKey(tenant), traceId)

          // 日常深拆（Layer 2）：异步六维拆解 + 保守生成新假设 → memory_write → model_review。复用 episodeId 幂等去重。
          void enqueueJob('daily_deep', { text, tenant, traceId }, `daily_deep_${episodeId}`, traceId)

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

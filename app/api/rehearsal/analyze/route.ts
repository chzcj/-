import { fail, ok } from '@/lib/api-response'
import { callFastJson, callFastTextStream, isFastAIEnabled, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { modelingIdentitySystemPrefix } from '@/lib/server/prompts/modeling-identity'
import { generateRehearsal } from '@/lib/server/store'
import { rehearsalAnalyzeSchema } from '@/lib/schemas'
import { resolveTenant } from '@/lib/server/memory/tenant'
import type { TenantId } from '@/lib/server/memory/tenant'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { getFrontendReadSliceLimits, isThickFamilyMemoryPack } from '@/lib/server/daily/frontend-read-pack'
import { getChildBasicInfo } from '@/lib/server/memory/database-manager'
import { createId } from '@/lib/storage/storageIds'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { recordFeatureTurn } from '@/lib/server/memory/turn-event'
import { createRehearsalStreamTracker, buildRehearsalStreamTask } from '@/lib/server/rehearsal/rehearsal-stream'
import type { RehearsalStreamEvent } from '@/types/rehearsal-stream'

type ProfileAwareRehearsal = {
  childLikelyHearing: string
  likelyTriggeredMechanisms: string[]
  possibleChildReaction: { immediateReaction: string; innerReaction: string; behaviorRisk: string }
  riskPoints: string[]
  saferVersion: string
  whyThisIsSafer: string
  avoidPhrases: string[]
  usedProfileEvidence: string[]
  taskTitle?: string
  closingAdvice?: string
  showSuggestedWording?: boolean
  dailyToneDetected?: boolean
  suggestedWordingHint?: string
  dailyToneReminder?: string
}

type RehearsalProfileContext = {
  primaryConditionalProfile?: string
  dominantProtectiveStrategies?: string[]
  familyInteractionCycles?: Array<{ patternName: string; description?: string; evidence?: string[] }>
  parentNarrativePattern?: string
  pendingHypotheses?: string[]
  evidenceSnippets?: string[]
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const body = await request.json().catch(() => ({}))
  const { parentText, mode, profileContext, rehearsalContext, fromSpecialFeature, rehearsalTranscript } = body

  // 缺原话不预演（交付文档 5.2.3）：先要原话，给引导。
  // 标准沟通预演入口（fromSpecialFeature）走 5.3 切换：空原话返回 special_collection 引导（非报错）。
  if (typeof parentText !== 'string' || !parentText.trim()) {
    if (fromSpecialFeature) {
      return ok({
        uiMode: 'special_collection',
        acknowledgement: '我先不急着帮你改说法，想先看看这句话到了孩子那里会被听成什么。',
        collectionGuide: '把你准备对孩子说的原话直接写进来，不用润色，按平时会说的样子。也可以顺带说一句：这次你真正想达成什么、最担心他怎么反应、过去类似的话通常怎么收场。',
        result: null
      })
    }
    return fail('NEED_PARENT_WORDS', '先把您准备对孩子说的原话写进来，我才能预演。不用润色，按平时会说的发就行。', undefined, 400)
  }

  /* profile-aware 路径：标准入口(fromSpecialFeature)默认画像感知，从服务端记忆检索；
     或有前端画像/家长采集的预演上下文亦进入。画像优先用前端传入，缺失则从记忆检索。 */
  const rc = (rehearsalContext || {}) as {
    parentGoal?: string
    parentWorry?: string
    whatHappenedBeforeTalk?: string
    sceneTitle?: string
    sceneSummary?: string
  }
  const parentRoundCount = typeof body.parentRoundCount === 'number' ? body.parentRoundCount : 0
  const hasRehearsalCtx = Boolean(
    rc.parentGoal || rc.parentWorry || rc.whatHappenedBeforeTalk || rc.sceneTitle || rc.sceneSummary
  )
  // 路由级 traceId/tenant：贯穿 TurnEvent 快照与采集写回（强字段闭环），各结果路径共享。
  const tenant = await resolveTenant()
  const traceId = createId('trace')
  if (parentText && mode !== 'conflict' && (fromSpecialFeature || profileContext || hasRehearsalCtx)) {
    try {
      const ctx = (profileContext || {}) as RehearsalProfileContext
      const [packet, digestLoaded, childBasic] = await Promise.all([
        // 首轮深检索建立画像感知；第 2 轮起对话上下文已在 rehearsalTranscript 中，
        // 用 fast 跳过 embedding 语义检索（实测每轮省 2–5s 首字延迟）
        buildDailyDialogueRetrievalPacket(parentText, tenant, { fast: parentRoundCount >= 1 }).catch(() => undefined),
        loadDeepModelDigest(tenant).catch(() => null),
        getChildBasicInfo(tenant).catch(() => null),
      ])
      const digest = digestLoaded
      const digestPack = pickDeepModelDigestPack(digest)
      const digestUsable = Boolean(digestPack.mechanismNarrative?.trim())
      if (!digestUsable) {
        // 冷启动不阻塞首字（实测同步 build 要 +4s）：后台补建供下一轮用，本轮以检索包兜底
        void buildDeepModelDigest(tenant).catch(() => undefined)
      }
      const deepModelDigest = pickDeepModelDigestPack(digest)
      const thick = isThickFamilyMemoryPack()
      const limits = getFrontendReadSliceLimits()
      const pastSimilarTalks = (packet?.recentRelatedEvents || []).slice(0, limits.recentEvents)
      const memHypotheses = ctx.pendingHypotheses?.length
        ? ctx.pendingHypotheses
        : (packet?.pendingHypotheses || [])

      const transcriptLines = Array.isArray(rehearsalTranscript)
        ? (rehearsalTranscript as Array<{ role?: string; text?: string }>)
            .filter((t) => t?.text?.trim())
            .slice(-12)
            .map((t) => `${t.role === 'child' ? '孩子' : '家长'}：${String(t.text).slice(0, 200)}`)
        : []

      const entryFactList = ((packet as { entryFacts?: string[] } | undefined)?.entryFacts || []).slice(
        0,
        limits.entryFacts
      )
      const childBasicLine = [
        childBasic?.age ? `${childBasic.age}岁` : '',
        childBasic?.grade || '',
      ].filter(Boolean).join('，')
      const narrativeCap = thick ? 900 : 500
      const mechanismCap = thick ? 1200 : 420
      const profileSummary = [
        // 孩子年龄/年级：决定预演孩子的用词、句长与发展阶段口吻
        childBasicLine ? `孩子基础信息：${childBasicLine}` : '',
        ctx.primaryConditionalProfile
          ? `画像：${ctx.primaryConditionalProfile.slice(0, narrativeCap)}`
          : (packet?.relevantChildStructureModels?.length
              ? `画像：${packet.relevantChildStructureModels.join('；').slice(0, narrativeCap)}`
              : ''),
        // 拟真优先：孩子真实语言样本与具体家庭事实排在机制之前，让「孩子」先像真人再谈机制
        deepModelDigest.childQuotes.length
          ? `孩子原话（复用其用词与句式）：${deepModelDigest.childQuotes.join('；')}`
          : '',
        deepModelDigest.anchoredFacts.length
          ? `锚定事实（台词可自然提及）：${deepModelDigest.anchoredFacts.slice(0, limits.entryFacts).join('；')}`
          : '',
        entryFactList.length ? `采集到的具体家庭事实：${entryFactList.join('；')}` : '',
        deepModelDigest.structuralTensions.length
          ? `结构张力：${deepModelDigest.structuralTensions.join('；')}`
          : '',
        deepModelDigest.interactionLoops.length
          ? `家庭互动循环（家长扳机→孩子接收→孩子反应，决定孩子怎么接话）：${deepModelDigest.interactionLoops.join('；')}`
          : (ctx.familyInteractionCycles?.length
              ? `家庭循环：${ctx.familyInteractionCycles.slice(0, 4).map(c => c.patternName).join('；')}`
              : (packet?.matchedMechanisms?.length
                  ? `家庭模式：${packet.matchedMechanisms.slice(0, limits.matchedMechanisms).join('；')}`
                  : '')),
        deepModelDigest.mechanismNarrative
          ? `机制叙事：${deepModelDigest.mechanismNarrative.slice(0, mechanismCap)}`
          : '',
        ctx.dominantProtectiveStrategies?.length
          ? `保护策略：${ctx.dominantProtectiveStrategies.slice(0, 4).join('；')}`
          : '',
        ctx.evidenceSnippets?.length ? `证据片段：${ctx.evidenceSnippets.slice(0, 5).join('；')}` : '',
        memHypotheses.length
          ? `待验证：${memHypotheses.slice(0, limits.pendingHypotheses).join('；')}`
          : '',
        rc.sceneTitle ? `当前预演场景：${rc.sceneTitle}` : '',
        rc.sceneSummary ? `场景摘要：${rc.sceneSummary.slice(0, 200)}` : '',
        rc.parentGoal ? `家长这次真正想达成：${rc.parentGoal}` : '',
        rc.parentWorry ? `家长最担心孩子的反应：${rc.parentWorry}` : '',
        rc.whatHappenedBeforeTalk ? `沟通前置背景：${rc.whatHappenedBeforeTalk}` : '',
        pastSimilarTalks.length ? `过往类似沟通：${pastSimilarTalks.join('；')}` : '',
        transcriptLines.length ? `本场已发生对话：\n${transcriptLines.join('\n')}` : '',
      ].filter(Boolean).join('\n')

      if (profileSummary.trim() || fromSpecialFeature) {
        // 流式 NDJSON：reaction（孩子回复）逐字流出，其余字段 final JSON。
        // 收益：用户 ~3s 看到 reaction 首字逐字出现，不必等 8s 完整 JSON。
        // prompt cache 优化：system 只保留稳定规则（可 cache），动态 profileSummary 移到 user payload。
        // S5：稳定前缀拼 SecondMe 协作者身份 §A+§C，与交流/机制链人格对齐；不改流式协议。
        const encoder = new TextEncoder()
        const identityPrefix = modelingIdentitySystemPrefix()
        const system = `${identityPrefix ? `${identityPrefix}\n\n---\n\n` : ''}你是 ChildOS 的沟通预演 Agent。你只做画像感知的亲子沟通预演。

字段阅读指引（payload 中逐项读取，优先具体事实、其次机制）：
- profileContext：画像综合。其中「孩子原话」是这个孩子的真实语言样本——模仿其用词、句式、语气与句长；「锚定事实/采集到的具体家庭事实」是已确认的真实事件——孩子台词可以自然提及（如具体的作业、考试、约定）；「家庭互动循环」给出家长扳机→孩子接收→孩子反应的完整链——它决定孩子会怎么接这句话。
- deepModelDigest：childQuotes（孩子原话）、anchoredFacts（锚定事实）、interactionLoops（互动循环）、parentInteractionStyle（家长惯常风格）——与 profileContext 互补，缺一边就读另一边。
- retrievalPack：entryFacts（四模块采集的具体事实）、childQuotes、matchedMechanisms。

规则：
- 【先像孩子，再谈机制】孩子回复必须先像「这个孩子」真实说话：优先复用孩子原话样本中的用词与句式，按其句长说话；能提及锚定事实里最近真实发生的事时优先提及。机制只作为台词背后的动机自然流露，禁止让孩子说出分析式、说教式、总结式的话。没有孩子原话样本时，按画像中的年龄段与防御风格推断口吻，禁止用通用小孩模板。
- 若提供了「本场已发生对话」，必须延续该对话上下文：孩子回复要接住前文，可引用家长上一轮原话中的关键词，禁止当作互不相关的单句分析。
- 家长发来的就是一段完整自述：他这次真正想达成什么、最担心孩子怎么反应、谈话前发生了什么，可能都内联在这段话里——请主动从中识别并使用，不要因为没有单独字段就忽略。
- 必须结合家长这次真正想达成的目标，以及过往类似沟通的结果——避免重复已经失败过的说法。
- possibleChildReaction.immediateReaction：用孩子口吻，带情绪与防御；用词句式贴近孩子原话样本；机制（如催促→控制感、检查→被评价）只体现在情绪与反应方式上，不得说出机制名词。
- childLikelyHearing：对照画像里的具体模式，写孩子内心如何理解家长这句话（分析，不是孩子原话）；禁止空泛「觉得被批评」。
- 不要泛泛说"多鼓励少批评"。
- 不要说家长控制欲强、孩子就是懒。
- saferVersion 写一句家长可以直接说的更稳版本（仅用于结束页建议，模拟对话中不展示）。
- closingAdvice 结合本轮预演对话，给家长 2-3 句针对性沟通建议（总结预演中的卡点 + 下一步怎么试），禁止泛泛鸡汤。
- taskTitle 是从 saferVersion 提炼的"今晚要试"任务标题，祈使句式 6–24 字，描述动作而非照抄台词。
- dailyToneDetected：若家长像在「交流页」向 AI 倾诉/分析（长叙述、问怎么办、讲今天发生了什么），而非对孩子说的话，则为 true。
- dailyToneReminder：dailyToneDetected 为 true 时，一句简练提醒（≤40字）：正在预演，请只回复你会对孩子说的话。
- showSuggestedWording：当已试够几种说法（parentRoundCount≥2 且 saferVersion 有参考价值）时为 true。
- suggestedWordingHint：showSuggestedWording 为 true 时，给家长一句可直接试的 softer 说法（20-50字）。`

        return new Response(
          new ReadableStream({
            async start(controller) {
              const send = (evt: RehearsalStreamEvent) =>
                controller.enqueue(encoder.encode(`${JSON.stringify(evt)}\n`))
              try {
                send({ type: 'start', traceId })

                const tracker = createRehearsalStreamTracker({
                  onReactionDelta: (delta) => send({ type: 'reaction_delta', delta }),
                })

                const raw = await callFastTextStream(
                  system,
                  {
                    task: buildRehearsalStreamTask(),
                    parentMessage: parentText,
                    profileContext: profileSummary.slice(0, 3000),
                    deepModelDigest,
                    retrievalPack: packet ? {
                      childStructureModels: packet.relevantChildStructureModels || [],
                      matchedMechanisms: packet.matchedMechanisms || [],
                      pendingHypotheses: packet.pendingHypotheses || [],
                      familyPatterns: packet.familyInteractionPatterns || [],
                      entryFacts: (packet as { entryFacts?: string[] }).entryFacts || [],
                      childQuotes: (packet as { childQuotes?: string[] }).childQuotes || [],
                    } : undefined,
                    rehearsalTranscript: transcriptLines,
                    parentRoundCount,
                  },
                  (delta) => tracker.feed(delta),
                  // 前台表达层关闭隐式思考：孩子怎么回应由注入的画像/原话/循环决定，
                  // 无需模型现场推理（实测省数秒首字）。FRONT_AI_THINKING=on 回滚。
                  { maxTokens: 1400, disableThinking: frontAiThinkingDisabled() }
                )

                const { reaction, restJson } = tracker.finalize()
                // 合并：restJson（LLM 结构化字段）+ reaction（流式段，回填 immediateReaction）
                const aiResult: Partial<ProfileAwareRehearsal> = {
                  ...(restJson || {}),
                  possibleChildReaction: {
                    immediateReaction: reaction || (restJson as { possibleChildReaction?: { immediateReaction?: string } })?.possibleChildReaction?.immediateReaction || '',
                    innerReaction: (restJson as { possibleChildReaction?: { innerReaction?: string } })?.possibleChildReaction?.innerReaction || '',
                    behaviorRisk: (restJson as { possibleChildReaction?: { behaviorRisk?: string } })?.possibleChildReaction?.behaviorRisk || '',
                  },
                }
                const normalized = normalizeProfileAwareResult(aiResult, parentText, ctx, parentRoundCount)

                recordFeatureTurn({
                  traceId, tenant, mode: 'communication_rehearsal',
                  userMessage: parentText,
                  assistantReply: normalized.possibleChildReaction?.immediateReaction || normalized.childLikelyHearing,
                  specializedContextPack: {
                    rehearsalContext: rc, mode, fromSpecialFeature, profileAware: true,
                    retrievedFacts: {
                      profileSummary: profileSummary.slice(0, 1500),
                      pastSimilarTalks,
                      childModels: packet?.relevantChildStructureModels || [],
                      pendingHypotheses: memHypotheses
                    }
                  }
                })

                send({
                  type: 'final',
                  data: {
                    ...normalized,
                    traceId,
                    profileAware: true,
                    uiMode: 'result_view',
                    schemaVersion: 'childos.rehearsal.profile-aware.v1',
                  },
                  traceId,
                })
                controller.close()
              } catch (error) {
                console.error(`[rehearsal/stream] traceId=${traceId}:`, error)
                send({ type: 'error', code: 'REHEARSAL_STREAM_FAILED', message: '这次没有模拟出来，可以再试一次。' })
                controller.close()
              }
            }
          }),
          {
            headers: {
              'Content-Type': 'application/x-ndjson; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              Connection: 'keep-alive',
              'X-Accel-Buffering': 'no',
            },
          }
        )
      }
    } catch {}
  }

  if (mode === 'conflict' && parentText) {
    try {
      const result = await callFastJson<{
        headline: string; explanation: string; escalationSentence: string
        childMayHear: string; suggestedReplacement: string
      }>(
        `你是 ChildOS 的冲突复盘 agent。家长贴了一段亲子冲突对话。分析这段对话：
要求：headline 一句话概括冲突核心；explanation 解释家长和孩子的真实互动机制；escalationSentence 指出最容易让冲突升级的一句话；childMayHear 说明孩子可能怎么听成这句话；suggestedReplacement 给一句更稳的替换说法。
只输出 JSON，不输出 Markdown 或解释。`,
        { dialogue: parentText },
        { maxTokens: 1000 }
      ).catch(() => undefined)

      if (result?.headline) {
        recordFeatureTurn({
          traceId, tenant, mode: 'communication_rehearsal',
          userMessage: parentText, assistantReply: result.suggestedReplacement,
          specializedContextPack: { mode: 'conflict' }
        })
        return ok(result)
      }
    } catch {}
  }

  if (parentText) {
    try {
      const result = await callFastJson<{
        headline: string; explanation: string; childMayHear: string[]
        stuckPoint: string; suggestedWording: string
      }>(
        `你是 ChildOS 的沟通预演 agent。家长说了一句准备对孩子说的话。分析这句话：
要求：headline 一句话概括家长表达的关键问题；explanation 解释家长想表达的和孩子可能接收的差异；childMayHear 列出 2-3 条孩子可能的接收方式；stuckPoint 指出最容易卡住的地方；suggestedWording 给一句更有连接感的替换说法。
只输出 JSON，不输出 Markdown 或解释。`,
        { parentText },
        { maxTokens: 1000 }
      ).catch(() => undefined)

      if (result?.headline) {
        recordFeatureTurn({
          traceId, tenant, mode: 'communication_rehearsal',
          userMessage: parentText, assistantReply: result.suggestedWording,
          specializedContextPack: { rehearsalContext: rc, fromSpecialFeature }
        })
        return ok({ ...result, traceId, uiMode: 'result_view' })
      }
    } catch {}
  }

  const parsed = rehearsalAnalyzeSchema.safeParse(body)
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten())

  const result = await generateRehearsal(parsed.data.conversationId, await resolveTenant(), parsed.data.parentText)
  if (!result) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404)

  return ok({ rehearsalId: result.rehearsalId, result })
}

function normalizeProfileAwareResult(
  value: Partial<ProfileAwareRehearsal> | undefined,
  parentText: string,
  ctx: RehearsalProfileContext,
  parentRoundCount = 0
): ProfileAwareRehearsal {
  const fallback = buildProfileAwareFallback(parentText, ctx)
  const saferVersion = nonEmpty(value?.saferVersion, fallback.saferVersion)
  const dailyToneDetected =
    typeof value?.dailyToneDetected === 'boolean'
      ? value.dailyToneDetected
      : detectDailyTone(parentText)
  const showSuggestedWording =
    typeof value?.showSuggestedWording === 'boolean'
      ? value.showSuggestedWording
      : parentRoundCount >= 2 && Boolean(saferVersion)

  return {
    childLikelyHearing: nonEmpty(value?.childLikelyHearing, fallback.childLikelyHearing),
    likelyTriggeredMechanisms: nonEmptyArray(value?.likelyTriggeredMechanisms, fallback.likelyTriggeredMechanisms),
    possibleChildReaction: {
      immediateReaction: nonEmpty(value?.possibleChildReaction?.immediateReaction, fallback.possibleChildReaction.immediateReaction),
      innerReaction: nonEmpty(value?.possibleChildReaction?.innerReaction, fallback.possibleChildReaction.innerReaction),
      behaviorRisk: nonEmpty(value?.possibleChildReaction?.behaviorRisk, fallback.possibleChildReaction.behaviorRisk),
    },
    riskPoints: nonEmptyArray(value?.riskPoints, fallback.riskPoints),
    saferVersion,
    whyThisIsSafer: nonEmpty(value?.whyThisIsSafer, fallback.whyThisIsSafer),
    avoidPhrases: nonEmptyArray(value?.avoidPhrases, fallback.avoidPhrases),
    usedProfileEvidence: nonEmptyArray(value?.usedProfileEvidence, fallback.usedProfileEvidence),
    taskTitle: value?.taskTitle?.trim() || undefined,
    closingAdvice: value?.closingAdvice?.trim() || undefined,
    dailyToneDetected,
    dailyToneReminder: dailyToneDetected
      ? nonEmpty(
          value?.dailyToneReminder,
          '预演里我在扮演孩子，请只回复你会对孩子说的那句话。'
        )
      : undefined,
    showSuggestedWording,
    suggestedWordingHint: showSuggestedWording
      ? nonEmpty(value?.suggestedWordingHint, saferVersion)
      : undefined,
  }
}

function detectDailyTone(parentText: string): boolean {
  const t = parentText.replace(/\s/g, '')
  if (t.length < 48) return false
  return /今天|昨晚|孩子今天|怎么办|分析一下|帮我看|发生了什么|情绪|作业拖延/.test(t)
}

function buildProfileAwareFallback(parentText: string, ctx: RehearsalProfileContext): ProfileAwareRehearsal {
  const mechanisms = inferMechanisms(parentText, ctx)
  const evidence = collectProfileEvidence(ctx)
  const saferVersion = buildSaferVersion(parentText)
  const hearing = buildChildHearing(parentText, mechanisms)

  return {
    childLikelyHearing: hearing,
    likelyTriggeredMechanisms: mechanisms,
    possibleChildReaction: {
      immediateReaction: '先沉默、顶一句，或者嘴上答应来让这轮对话快点结束。',
      innerReaction: '他可能听到的不是帮助，而是又要进入被检查、被评价、被继续加码的任务链。',
      behaviorRisk: '表面配合，之后拖延、回避，或者转向手机来保留一点可控时间。'
    },
    riskPoints: [
      '把家长评价当成孩子事实',
      '把责任、道歉或帮助变成新的压力',
      '让孩子预期后面还会继续检查或加码'
    ],
    saferVersion,
    whyThisIsSafer: '这句话先把评价和追责拿掉，只确认一个具体事实或一个可完成的小边界，能降低孩子的防御感，也更符合他在低压力、低评价关系里更容易打开的画像。',
    avoidPhrases: ['骗我', '没有自觉', '没有责任感', '对得起谁', '什么时候自觉了再说'],
    usedProfileEvidence: evidence
  }
}

function inferMechanisms(parentText: string, ctx: RehearsalProfileContext): string[] {
  const mechanisms = [
    ...(ctx.familyInteractionCycles || []).map(c => c.patternName),
    ...(ctx.dominantProtectiveStrategies || [])
  ].filter(Boolean)

  const selected: string[] = []
  if (parentText.includes('骗') || parentText.includes('写完')) selected.push('检查—暴露—回避循环')
  if (parentText.includes('责任') || parentText.includes('男孩子') || parentText.includes('靠你')) selected.push('愧疚驱动短期配合')
  if (parentText.includes('道歉') || parentText.includes('写信')) selected.push('承诺放手—再次控制—孩子失望循环')
  if (parentText.includes('手机')) selected.push('用手机保留可控时间和恢复出口')
  if (parentText.includes('哥哥') || parentText.includes('姐姐')) selected.push('低压力外部关系更容易打开')
  if (parentText.includes('摆烂') || parentText.includes('就这样')) selected.push('失败退路保护')
  if (parentText.includes('计划') || parentText.includes('必须')) selected.push('任务边界模糊和加码压力')
  if (parentText.includes('省点心') || parentText.includes('安排好')) selected.push('提醒—表面配合—实际撤退循环')

  for (const mechanism of mechanisms) {
    if (selected.length >= 3) break
    if (!selected.includes(mechanism)) selected.push(mechanism)
  }
  return selected.slice(0, 4)
}

function collectProfileEvidence(ctx: RehearsalProfileContext): string[] {
  return [
    ctx.primaryConditionalProfile?.slice(0, 120),
    ...(ctx.dominantProtectiveStrategies || []).slice(0, 2),
    ...(ctx.familyInteractionCycles || []).slice(0, 2).map(c => c.patternName),
    ...(ctx.pendingHypotheses || []).slice(0, 1)
  ].filter((item): item is string => Boolean(item && item.trim()))
}

function buildChildHearing(parentText: string, mechanisms: string[]) {
  if (parentText.includes('骗') || parentText.includes('自觉')) {
    return `孩子可能听成：我又被定性成骗、不自觉了。结合${mechanisms[0] || '检查—暴露—回避循环'}，他更可能先防御或沉默，而不是马上补作业。`
  }
  if (parentText.includes('责任') || parentText.includes('男孩子')) {
    return `孩子可能听成：我现在这样不仅学习不行，连以后靠不靠得住都被否定了。这会触发愧疚，但很难转成持续行动。`
  }
  if (parentText.includes('道歉') || parentText.includes('写信')) {
    return `孩子可能听成：妈妈已经改了，所以现在问题又回到我身上。若他过去经历过承诺放手后再次控制，会更容易不相信这次沟通真的不同。`
  }
  if (parentText.includes('手机')) {
    return `孩子可能听成：我最后一点可控时间也要被拿走了。对他来说手机不只是玩，也可能是压力后的恢复出口。`
  }
  if (parentText.includes('哥哥') || parentText.includes('姐姐')) {
    return `孩子可能听成：连愿意帮我的哥哥姐姐也变成了压力和亏欠。原本低压力的外部支持，可能被家长这句话污染成新的评价。`
  }
  if (parentText.includes('摆烂')) {
    return `孩子可能听成：妈妈已经认定我放弃了。这个标签容易让他用沉默或随便来保护自己，避免再暴露失败感。`
  }
  if (parentText.includes('计划') || parentText.includes('必须')) {
    return `孩子可能听成：今晚又要进入一整套无法结束的任务链。计划越细，他越可能觉得后面还有检查和加码。`
  }
  return `孩子可能听成：妈妈说不是逼我，但后面还是要我按她的标准安排好。结合已有画像，他可能表面答应，行动上继续撤退。`
}

function buildSaferVersion(parentText: string) {
  if (parentText.includes('骗') || parentText.includes('写完')) {
    return '我看到作业现在还没完成。先不追究你刚才为什么说写完了，我们先把还差哪一小块弄清楚，只处理这一块。'
  }
  if (parentText.includes('责任') || parentText.includes('男孩子')) {
    return '我刚才其实是担心你以后会辛苦，不是要一下子把很重的责任压到你身上。我们先看今天这一件事，你愿意从哪一步开始？'
  }
  if (parentText.includes('道歉') || parentText.includes('写信')) {
    return '我知道我说过要改，你可能还不太相信。这次我先不催你表态，我们只约一个很小的变化，看我能不能先稳定做到。'
  }
  if (parentText.includes('手机')) {
    return '我不想直接把手机变成输赢。我们先定一个很小的边界：你先休息十分钟，之后只开始第一小步，我不追加别的。'
  }
  if (parentText.includes('哥哥') || parentText.includes('姐姐')) {
    return '哥哥姐姐愿意帮你，说明你不是一个人扛。你不用先证明对得起谁，我们先说说哪一块最卡。'
  }
  if (parentText.includes('摆烂') || parentText.includes('就这样')) {
    return '我不想把你说成摆烂。我更想知道，你现在是哪里觉得没劲，还是觉得怎么努力都没用？'
  }
  if (parentText.includes('计划') || parentText.includes('必须')) {
    return '今晚不用写一整周计划。你只选明天最容易开始的一小步，写清楚什么时候做、做到哪里就结束。'
  }
  return '我不是要你马上证明自己能安排好。我们先把今天最小的一步定下来，做到这一步就结束，我不再临时加任务。'
}

function nonEmpty(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function nonEmptyArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.some(item => typeof item === 'string' && item.trim())
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : fallback
}

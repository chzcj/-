import { fail, ok } from '@/lib/api-response'
import { callFastJson } from '@/lib/server/ark-agents'
import { generateRehearsal } from '@/lib/server/store'
import { rehearsalAnalyzeSchema } from '@/lib/schemas'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { buildMemoryWritePlan, createDailyUpdate } from '@/lib/server/memory/write/decision-engine'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import { createId } from '@/lib/storage/storageIds'

type ProfileAwareRehearsal = {
  childLikelyHearing: string
  likelyTriggeredMechanisms: string[]
  possibleChildReaction: { immediateReaction: string; innerReaction: string; behaviorRisk: string }
  riskPoints: string[]
  saferVersion: string
  whyThisIsSafer: string
  avoidPhrases: string[]
  usedProfileEvidence: string[]
}

type RehearsalProfileContext = {
  primaryConditionalProfile?: string
  dominantProtectiveStrategies?: string[]
  familyInteractionCycles?: Array<{ patternName: string; description?: string; evidence?: string[] }>
  parentNarrativePattern?: string
  pendingHypotheses?: string[]
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { parentText, mode, profileContext, rehearsalContext, fromSpecialFeature } = body

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
  const rc = (rehearsalContext || {}) as { parentGoal?: string; parentWorry?: string; whatHappenedBeforeTalk?: string }
  const hasRehearsalCtx = Boolean(rc.parentGoal || rc.parentWorry || rc.whatHappenedBeforeTalk)
  if (parentText && mode !== 'conflict' && (fromSpecialFeature || profileContext || hasRehearsalCtx)) {
    try {
      const ctx = (profileContext || {}) as RehearsalProfileContext
      const tenant = await resolveTenant()
      const packet = await buildDailyDialogueRetrievalPacket(parentText, tenant).catch(() => undefined)
      const pastSimilarTalks = (packet?.recentRelatedEvents || []).slice(0, 3)
      const memHypotheses = ctx.pendingHypotheses?.length ? ctx.pendingHypotheses : (packet?.pendingHypotheses || [])

      const profileSummary = [
        ctx.primaryConditionalProfile
          ? `画像：${ctx.primaryConditionalProfile.slice(0, 360)}`
          : (packet?.relevantChildStructureModels?.length ? `画像：${packet.relevantChildStructureModels.join('；').slice(0, 360)}` : ''),
        ctx.dominantProtectiveStrategies?.length ? `保护策略：${ctx.dominantProtectiveStrategies.slice(0, 4).join('；')}` : '',
        ctx.familyInteractionCycles?.length
          ? `家庭循环：${ctx.familyInteractionCycles.slice(0, 4).map(c => c.patternName).join('；')}`
          : (packet?.matchedMechanisms?.length ? `家庭机制：${packet.matchedMechanisms.slice(0, 4).join('；')}` : ''),
        memHypotheses.length ? `待验证：${memHypotheses.slice(0, 3).join('；')}` : '',
        rc.parentGoal ? `家长这次真正想达成：${rc.parentGoal}` : '',
        rc.parentWorry ? `家长最担心孩子的反应：${rc.parentWorry}` : '',
        rc.whatHappenedBeforeTalk ? `沟通前置背景：${rc.whatHappenedBeforeTalk}` : '',
        pastSimilarTalks.length ? `过往类似沟通：${pastSimilarTalks.join('；')}` : ''
      ].filter(Boolean).join('\n')

      if (profileSummary.trim() || fromSpecialFeature) {
        const aiResult = await callFastJson<Partial<ProfileAwareRehearsal>>(
          `你是 ChildOS 的沟通预演 Agent。你只做画像感知的亲子沟通预演。

${profileSummary}

请判断家长这句话在这个孩子画像里会被怎样接收，并给一句更稳妥的可直接说出口版本。

规则：
- 家长发来的就是一段完整自述：他这次真正想达成什么、最担心孩子怎么反应、谈话前发生了什么，可能都内联在这段话里——请主动从中识别并使用，不要因为没有单独字段就忽略。
- 必须结合家长这次真正想达成的目标，以及过往类似沟通的结果——避免重复已经失败过的说法。
- 必须使用画像中的机制、保护策略或家庭循环。
- 不要泛泛说"多鼓励少批评"。
- 不要说家长控制欲强、孩子就是懒。
- saferVersion 必须是一句家长可以直接说的话。

只输出 JSON，字段固定为：
childLikelyHearing: string
likelyTriggeredMechanisms: string[]
possibleChildReaction: { immediateReaction:string, innerReaction:string, behaviorRisk:string }
riskPoints: string[]
saferVersion: string
whyThisIsSafer: string
avoidPhrases: string[]
usedProfileEvidence: string[]`,
          { parentMessage: parentText, profileContext: profileSummary.slice(0, 1500) }
        ).catch(() => undefined)

        const normalized = normalizeProfileAwareResult(aiResult, parentText, ctx)
        if (fromSpecialFeature) void writeBackRehearsal(parentText) // 采集写回（异步，幂等）
        return ok({
          ...normalized,
          profileAware: true,
          uiMode: 'result_view', // 5.3：有原话→已可预演→结果展示
          schemaVersion: 'childos.rehearsal.profile-aware.v1'
        })
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
        { dialogue: parentText }
      ).catch(() => undefined)

      if (result?.headline) return ok(result)
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
        { parentText }
      ).catch(() => undefined)

      if (result?.headline) {
        if (fromSpecialFeature) void writeBackRehearsal(parentText)
        return ok({ ...result, uiMode: 'result_view' })
      }
    } catch {}
  }

  const parsed = rehearsalAnalyzeSchema.safeParse(body)
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten())

  const result = await generateRehearsal(parsed.data.conversationId, parsed.data.parentText)
  if (!result) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404)

  return ok({ rehearsalId: result.rehearsalId, result })
}

/* 沟通预演采集写回（交付文档 5.3.16）：与教育诊断/家庭规划一致，把家长原话写入记忆，
   预演越用越懂家庭。异步、幂等、绝不阻塞前台；仅标准入口(fromSpecialFeature)、非 conflict 调用。 */
async function writeBackRehearsal(parentText: string): Promise<void> {
  try {
    const tenant = await resolveTenant()
    const traceId = createId('trace')
    const plan = buildMemoryWritePlan({
      tenant,
      dailyUpdates: [createDailyUpdate(`[沟通预演] ${parentText}`, 'insufficient', [], tenant, traceId)],
      rationale: {
        whyUpdate: '沟通预演采集，记录家长准备说的原话与意图',
        whyNotPromoteSomeItems: '预演输入属操作性上下文，暂不升级为长期判断',
        riskOfOvergeneralization: '',
        nextVerificationNeed: ''
      }
    })
    void enqueueJob('memory_write', { plan, tenant }, null, traceId)
    // Episode 抽取统一走队列（对齐 daily / 其它专项）：可追踪、可重试、幂等。
    const episodeId = deriveEpisodeId(parentText, { familyId: tenant.familyId, childId: tenant.childId })
    void enqueueJob('episode_ingest', {
      text: parentText,
      ctx: { sourceEventId: traceId, familyId: tenant.familyId, childId: tenant.childId, episodeId }
    }, episodeId, traceId)
  } catch (e) {
    console.error('[rehearsal] 写回失败（不影响前台）:', e)
  }
}

function normalizeProfileAwareResult(
  value: Partial<ProfileAwareRehearsal> | undefined,
  parentText: string,
  ctx: RehearsalProfileContext
): ProfileAwareRehearsal {
  const fallback = buildProfileAwareFallback(parentText, ctx)
  return {
    childLikelyHearing: nonEmpty(value?.childLikelyHearing, fallback.childLikelyHearing),
    likelyTriggeredMechanisms: nonEmptyArray(value?.likelyTriggeredMechanisms, fallback.likelyTriggeredMechanisms),
    possibleChildReaction: {
      immediateReaction: nonEmpty(value?.possibleChildReaction?.immediateReaction, fallback.possibleChildReaction.immediateReaction),
      innerReaction: nonEmpty(value?.possibleChildReaction?.innerReaction, fallback.possibleChildReaction.innerReaction),
      behaviorRisk: nonEmpty(value?.possibleChildReaction?.behaviorRisk, fallback.possibleChildReaction.behaviorRisk),
    },
    riskPoints: nonEmptyArray(value?.riskPoints, fallback.riskPoints),
    saferVersion: nonEmpty(value?.saferVersion, fallback.saferVersion),
    whyThisIsSafer: nonEmpty(value?.whyThisIsSafer, fallback.whyThisIsSafer),
    avoidPhrases: nonEmptyArray(value?.avoidPhrases, fallback.avoidPhrases),
    usedProfileEvidence: nonEmptyArray(value?.usedProfileEvidence, fallback.usedProfileEvidence),
  }
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

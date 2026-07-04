import type { DailyCards, OrchestrationOutput } from '@/types/database'
import {
  humanReadableHeadline,
  isPlaceholderProfileText,
  sanitizeForParent,
} from '@/lib/server/daily/profile-sanitize'

function truncate(text: string, max: number) {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export function buildFirstReading(output: OrchestrationOutput, cards: DailyCards, userText: string): string {
  const ctx = output.retrievedContext
  const mechanism = sanitizeForParent(ctx.matchedMechanisms?.[0]?.replace(/^还在验证：?/, ''))
  const pattern = sanitizeForParent(ctx.relevantFamilyInteractionPatterns?.[0])

  if (output.inputType === 'ask_advice') {
    if (userText.includes('今晚') || userText.includes('怎么说') || userText.includes('怎么开口')) {
      return '你今晚最难的不是「要不要说」，而是怎么不把反馈变成又一轮审问。'
    }
    return humanReadableHeadline({ mechanism, pattern, fallback: '这次重点不是谁对谁错，而是怎么把对话从审问拉回具体一步。' })
  }

  if (userText.includes('写完') && (userText.includes('检查') || userText.includes('空着') || userText.includes('漏'))) {
    return '这次重点不只是「他说写完但其实漏了」，而是他可能把「检查」听成了：今晚又要进入补漏、订正、评价的一整套流程。'
  }

  if (userText.includes('不谈学习') || (userText.includes('同学') && userText.includes('笑话'))) {
    return '这条说明他不是和你整体断开，而是学习话题一进来，关系气氛就变了。'
  }

  return humanReadableHeadline({
    mechanism,
    pattern,
    hypothesis: ctx.relevantPendingHypotheses?.[0],
    fallback: cards.evidenceBasis || '这次不像一次孤立反应，更像是熟悉场景里防御被提前拉高。',
  })
}

/** 合并 history + evidence → 带推理的「我记得的几个线索」 */
export function buildMemoryBridge(
  output: OrchestrationOutput,
  cards: DailyCards,
  userText: string
): string[] {
  const ctx = output.retrievedContext
  const mechanism = sanitizeForParent(ctx.matchedMechanisms?.[0]?.replace(/^还在验证：?/, ''))
  const pattern = sanitizeForParent(ctx.relevantFamilyInteractionPatterns?.[0])
  const hypo = sanitizeForParent(ctx.relevantPendingHypotheses?.[0]?.replace(/^还在验证：?/, ''))

  const reasoning: string[] = []

  if (pattern && mechanism) {
    reasoning.push(
      `从你们家这几周的运行方式看，${truncate(pattern, 72)}；而${truncate(mechanism, 72)}。这次和这条线索是对得上的。`
    )
  } else if (pattern) {
    reasoning.push(`前面你提到过：${truncate(pattern, 100)}。这次像是在同一套家庭节奏里又出现了一次。`)
  } else if (mechanism) {
    reasoning.push(`从最近几次看，反复出现的信号是：${truncate(mechanism, 100)}。`)
  } else if (hypo) {
    reasoning.push(`我还在验证的一个方向是：${truncate(hypo, 100)}。这次材料会并进去对照。`)
  }

  if (userText.includes('老师') && userText.includes('反馈')) {
    reasoning.push('只要老师一反馈、你一急、开始检查，他往往就回到旧路；少讲大道理、说好不加任务时，他会好一点。')
  }

  const hasMemory =
    (ctx.relevantPastEvents?.length || 0) > 0 ||
    (ctx.relevantEntryEvidencePacks?.length || 0) > 0
  if (hasMemory && reasoning.length === 0) {
    reasoning.push('结合记忆库里最近的记录，这次不是完全孤立的一次。')
  }

  return reasoning.slice(0, 2)
}

export function buildFamilyStructure(output: OrchestrationOutput, userText: string): string | undefined {
  const ctx = output.retrievedContext
  const mechanism = sanitizeForParent(ctx.matchedMechanisms?.[0])
  const pattern = sanitizeForParent(ctx.relevantFamilyInteractionPatterns?.[0])
  const model = sanitizeForParent(ctx.relevantChildStructureModel?.[0])

  if (userText.includes('检查') || userText.includes('漏') || userText.includes('订正')) {
    return '放回你们家的结构里看，检查不只是一个中性动作。对你来说，检查是负责；对他来说，检查后面常常接着新的任务、纠错和评价。他可能不是怕你看到空题，而是怕一被检查，今晚就不只是补两题了。'
  }

  if (userText.includes('老师') && (userText.includes('反馈') || userText.includes('怎么说'))) {
    return '在这个家里，老师反馈、订正、抽查、补漏这些压力，最后往往落到你这里执行；孩子面对的常常不是一道题，而是「妈妈发现问题后，整个晚上可能又被重新安排」。'
  }

  if (userText.includes('不谈学习') || userText.includes('笑话')) {
    return '妈妈现在既是妈妈，也是学习流程的执行者。孩子一听你问学校，很容易预判后面会接作业、订正、重点，所以他提前防御；只要不接学习，亲子通道其实还在。'
  }

  if (model && !isPlaceholderProfileText(model)) {
    return model.length > 280 ? `${model.slice(0, 280)}…` : model
  }

  if (pattern) {
    return `在你们家的实际运行里，${truncate(pattern, 160)}。孩子反抗的对象表面是你，实际常常是在反抗一整套「反馈—检查—补漏—评价」流程。`
  }

  if (mechanism) {
    return `从结构上看，${truncate(mechanism, 160)}。拖延或顶嘴不一定是懒，也可能是他少数能暂停这套流程的方式。`
  }

  return undefined
}

export function buildSceneChildVoice(userText: string): string[] {
  if (userText.includes('抄') || userText.includes('认真写也没用')) {
    return [
      '我不是完全不想认真，我是觉得认真好像也换不来确定的结果。别人抄也能过，我认真写错了反而更像被抓出来。',
    ]
  }
  if (userText.includes('不愿意说') && userText.includes('学校')) {
    return ['我不是完全不想说学校，是怕一说出来，最后又会绕到老师、作业、重点、成绩。']
  }
  if (userText.includes('不谈学习') || (userText.includes('同学') && userText.includes('笑话'))) {
    return ['我不是不想跟你说话。我是怕一开口，聊着聊着又会滑到学习上。只要不谈这个，我其实能放松一点。']
  }
  if (userText.includes('写完') && (userText.includes('检查') || userText.includes('空着'))) {
    return [
      '我说写完，可能不是想骗你，而是想把这件事先结束。因为一打开检查，后面就不只是补两题，可能还会变成又被重新盯一遍。',
    ]
  }
  if (userText.includes('需不需要帮忙') || userText.includes('化学题')) {
    return ['我不是完全拒绝帮助。我拒绝的可能是「被查出来不会」，而不是「有人帮我把这一题看懂」。']
  }
  if (userText.includes('先做哪一科') || userText.includes('我没有安排')) {
    return ['如果你让我自己选先做哪一科，我至少知道这一步是我能决定的，不是又被你排满一整晚。']
  }
  return [
    '我知道要做，但我一开始就会想到后面会被看、被纠正。',
    '要是我拖一下，说不定今晚就不会马上进入那一整套流程。',
  ]
}

export function buildTryOnce(output: OrchestrationOutput, cards: DailyCards, userText: string): string[] {
  if (output.inputType === 'ask_advice') {
    const lines: string[] = []
    if (userText.includes('老师') && userText.includes('反馈')) {
      lines.push(
        '可以先这样开口：「老师今天说订正没交，我现在确实有点急。但我不想一上来就审你。我们先只弄清一件事：这次没交，是不会、忘了，还是不想交？」'
      )
      lines.push('如果他说「随便」或沉默，继续缩小：「那我们先不谈态度，只看这一次。你指一下是哪一部分卡住。」')
    } else {
      lines.push(
        '今晚不要从「你是不是又糊弄我」开口。可以说：「我看到有两处没完成。我先不扩大到别的，只处理这两处。你先告诉我，是不会，还是漏看了？」'
      )
    }
    lines.push('今晚要验证的不是他能不能立刻端正态度，而是：当你不从评价开始，他能不能说出一个具体原因。')
    return lines
  }

  const seed = sanitizeForParent(cards.adviceSeed) || sanitizeForParent(output.retrievedContext.relevantFamilyInteractionPatterns?.[0])
  if (seed) return [truncate(seed, 200)]

  return ['今晚先只改「开始」的入口：不要一上来就检查或评价，把目标缩到一个很小的开始动作。']
}

export function buildVerifyThisTime(output: OrchestrationOutput, userText: string): string | undefined {
  if (output.inputType === 'ask_advice') {
    return '当你不从评价开始，他能不能说出一个具体原因——这会决定后面是继续高压，还是出现一次低冲突对话。'
  }
  if (userText.includes('检查') || userText.includes('漏')) {
    return '当检查不再自动扩大成整晚补漏，他会不会更愿意承认具体没完成的地方。'
  }
  if (userText.includes('打球') || userText.includes('活动')) {
    return '活动回来后情绪更顺时，作业启动是否也会稍微容易一点。'
  }
  return '接下来 2–3 次，看同一情境下他是继续防御，还是出现一次低冲突配合。'
}

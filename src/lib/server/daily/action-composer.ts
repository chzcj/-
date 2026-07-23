import type { OrchestrationOutput } from '@/types/database'
import type { DailyCards } from '@/types/database'
import type { DailyAction, DailySection } from '@/types/daily-message'

const TASK_TITLE_BANNED =
  /模式能对上|标记为|观察记录|当前输入|已有画像|写入记忆|判断有更新|待验证/i

function sectionHasContent(section: DailySection): boolean {
  return Boolean(
    section.streamingText?.trim() ||
      section.paragraphs?.some((value) => value.trim()) ||
      section.items?.some((value) => value.trim()) ||
      section.quotes?.some((value) => value.trim()) ||
      section.note?.trim()
  )
}

/** 从 advice / 正文抽 6–24 字祈使句；禁止 prose 叙事首句当标题 */
function deriveImperativeTaskTitle(
  sections: DailySection[],
  fullText: string,
  given?: string
): string {
  const fallback = '今晚先试一次小步骤'
  if (given && given.trim().length >= 4 && !TASK_TITLE_BANNED.test(given)) {
    return given.trim().slice(0, 48)
  }

  const advice = sections.find((s) => s.id === 'advice' && !s.hidden)
  const candidates = [
    ...(advice?.paragraphs || []),
    ...(advice?.items || []),
  ]
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && !TASK_TITLE_BANNED.test(s))

  const actionLike =
    candidates.find((s) => /^(先|问|说|记录|观察|约定|只做|试|把|等|停|补|今晚|今天)/.test(s)) ||
    candidates[0]

  if (actionLike) {
    const cut = actionLike.split(/[。！？\n]/)[0]?.trim() || actionLike
    const title = cut.slice(0, 48)
    if (/^(先|问|说|记录|观察|约定|只做|试|把|等|停|补|今晚|今天|别)/.test(title)) return title
    return `先${title}`.slice(0, 48)
  }

  // 三级兜底前先从正文挖「今晚/今天…」祈使句（advice section 缺席但正文含具体建议的轮次）
  const proseSentence = fullText
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .find((s) => s.length >= 6 && s.length <= 40 && /^(今晚|今天|先|试着|只)/.test(s) && !TASK_TITLE_BANNED.test(s))
  if (proseSentence) return proseSentence.slice(0, 48)

  return fallback
}

/** 是否有资格提供「保存为今晚任务」：拿不出具体标题（只能用写死兜底）说明本轮没有可执行建议，
 *  保存出来就是「今晚先试一次小步骤」这种空壳任务卡（真实用户投诉），不如不给按钮。 */
function hasSubstantiveTask(resolvedTitle: string): boolean {
  return resolvedTitle !== '今晚先试一次小步骤'
}

export function composeDailyActions(
  output: OrchestrationOutput,
  cards: DailyCards,
  sections: DailySection[],
  fullText: string,
  taskTitle?: string,
  userText?: string
): DailyAction[] {
  const actions: DailyAction[] = []
  const hiddenIds = sections.filter((s) => s.hidden).map((s) => s.id)
  const hiddenReady = hiddenIds.length === 0 || sections.filter((s) => s.hidden).every(sectionHasContent)
  const rel = output.relationshipToExistingModel.type
  const lowConf =
    rel === 'insufficient' ||
    output.routingDecision.frontResponseType === 'one_key_followup'

  const resolvedTaskTitle = deriveImperativeTaskTitle(sections, fullText, taskTitle)
  const seedScene = fullText.split(/[。！？\n]/).find((s) => s.trim().length > 4)?.trim()?.slice(0, 28)
  const rehearsalSeed = (userText || fullText).trim().slice(0, 1200)
  const rehearsalText = userText || fullText
  const hasCommunicationEvidence = Boolean(
    output.retrievedContext.entryFacts?.length ||
      output.retrievedContext.relevantFamilyInteractionPatterns?.length ||
      output.retrievedContext.childQuotes?.length
  )
  const wantsRehearsal =
    hasCommunicationEvidence &&
    /吵|催|顶嘴|发脾气|开口|沟通|对峙|僵|拒绝|不想听|说重了|怎么和.{0,8}说/.test(rehearsalText)

  if (output.inputType === 'risk_followup') {
    actions.push({
      id: 'watch_points',
      label: '接下来观察什么',
      kind: 'expand_sections',
      primary: true,
      payload: { sectionIds: hiddenIds.length ? hiddenIds : ['child_voice'], hiddenReady },
    })
    actions.push({
      id: 'back_daily',
      label: '回到交流继续记',
      kind: 'follow_up_text',
      payload: { seedText: '我想补充今天孩子状态的一个变化。' },
    })
    return actions
  }

  if (hiddenIds.length) {
    actions.push({
      id: 'expand_deep',
      label: '查看深度展开',
      kind: 'expand_sections',
      primary: true,
      payload: { sectionIds: hiddenIds, hiddenReady },
    })
  }

  if (wantsRehearsal && rehearsalSeed.length >= 8) {
    const sceneId = /手机/.test(fullText)
      ? 'phone'
      : /吵|说重了|僵|修复|老师|学校|告状/.test(fullText)
        ? 'after_conflict'
        : 'homework_start'
    actions.push({
      id: 'open_rehearsal',
      label: '沟通预演',
      kind: 'rehearsal',
      primary: !hiddenIds.length,
      payload: {
        seedText: rehearsalSeed,
        sceneId,
        parentOriginalText: (userText || '').trim().slice(0, 1600),
        rehearsalGoal: '围绕刚才这件事，练一句更容易被孩子听进去的开口。',
        route: '/rehearsal',
      },
    })
  }

  if (output.inputType === 'ask_advice') {
    actions.push({
      id: 'open_how_to_speak',
      label: '我现在怎么开口',
      kind: 'how_to_speak',
      primary: !hiddenIds.length,
      payload: {
        seedText: seedScene,
        route: '/daily/how-to-speak',
      },
    })
    if (hasSubstantiveTask(resolvedTaskTitle)) {
      actions.push({
        id: 'save_task',
        label: '保存为今晚任务',
        kind: 'task',
        payload: { seedText: seedScene, taskTitle: resolvedTaskTitle },
      })
    }
    return actions.slice(0, 4)
  }

  if (lowConf) {
    actions.push({
      id: 'prompt_line',
      label: '给我一个问法',
      kind: 'follow_up_text',
      primary: !hiddenIds.length,
      payload: { seedText: '请给我一个可以直接问孩子的问法，只给一个。' },
    })
    actions.push({
      id: 'focus_input',
      label: '我来描述现场',
      kind: 'follow_up_text',
      payload: {
        seedText: '我想补充现场细节：当时他在做什么、我第一句话是什么、他第一反应是什么、情绪在哪一步升级。',
      },
    })
    return actions.slice(0, 4)
  }

  if (
    output.inputType === 'ask_explanation' ||
    output.inputType === 'daily_observation' ||
    output.routingDecision.frontResponseType === 'model_based_explanation' ||
    output.routingDecision.frontResponseType === 'advice_from_dossier'
  ) {
    actions.push({
      id: 'open_how_to_speak',
      label: '我现在怎么开口',
      kind: 'how_to_speak',
      primary: !hiddenIds.length,
      payload: {
        seedText: seedScene,
        route: '/daily/how-to-speak',
      },
    })
  }

  if (
    (output.routingDecision.frontResponseType === 'model_based_explanation' ||
      output.routingDecision.frontResponseType === 'advice_from_dossier') &&
    hasSubstantiveTask(resolvedTaskTitle)
  ) {
    actions.push({
      id: 'save_task',
      label: '保存为今晚任务',
      kind: 'task',
      payload: { seedText: seedScene, taskTitle: resolvedTaskTitle },
    })
  }

  if (hiddenIds.length && actions.length < 3) {
    actions.push({
      id: 'continue_week',
      label: '继续结合这周情况看',
      kind: 'follow_up_text',
      payload: {
        seedText: '请结合这周类似场景，告诉我接下来 3 次最值得观察的对比点。',
      },
    })
  }

  if (actions.length === 0) {
    actions.push({
      id: 'next_advice',
      label: '给一个小方法',
      kind: 'follow_up_text',
      primary: true,
      payload: {
        seedText: '请基于刚才的内容，给我下一步建议：只给一个方向，并嵌入我们家的真实流程。',
      },
    })
  }

  return actions.slice(0, 4)
}

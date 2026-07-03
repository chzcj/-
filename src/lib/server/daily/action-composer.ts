import type { OrchestrationOutput } from '@/types/database'
import type { DailyCards } from '@/types/database'
import type { DailyAction, DailySection } from '@/types/daily-message'

export function composeDailyActions(
  output: OrchestrationOutput,
  cards: DailyCards,
  sections: DailySection[],
  fullText: string,
  taskTitle?: string
): DailyAction[] {
  const actions: DailyAction[] = []
  const hiddenIds = sections.filter((s) => s.hidden).map((s) => s.id)
  const rel = output.relationshipToExistingModel.type
  const highConf = cards.confidenceMode !== 'low'
  const lowConf =
    rel === 'insufficient' ||
    output.routingDecision.frontResponseType === 'one_key_followup'

  if (output.inputType === 'risk_followup') {
    actions.push({
      id: 'watch_points',
      label: '接下来观察什么',
      kind: 'expand_sections',
      primary: true,
      payload: { sectionIds: hiddenIds.length ? hiddenIds : ['deep_analysis'] },
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
      payload: { sectionIds: hiddenIds },
    })
  }

  if (output.inputType === 'ask_advice') {
    actions.push({
      id: 'open_rehearsal',
      label: '我现在怎么开口',
      kind: 'rehearsal',
      primary: !hiddenIds.length,
      payload: {
        seedText: fullText.split(/[。！？\n]/).find((s) => s.trim().length > 4)?.trim()?.slice(0, 24),
      },
    })
    actions.push({
      id: 'save_task',
      label: '保存为今晚任务',
      kind: 'task',
      payload: { seedText: fullText.slice(0, 48), taskTitle },
    })
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
    output.routingDecision.frontResponseType === 'model_based_explanation'
  ) {
    actions.push({
      id: 'open_rehearsal',
      label: '我现在怎么开口',
      kind: 'rehearsal',
      primary: !hiddenIds.length,
      payload: {
        seedText: fullText.split(/[。！？\n]/).find((s) => s.trim().length > 4)?.trim()?.slice(0, 24),
      },
    })
  }

  if (output.routingDecision.frontResponseType === 'model_based_explanation') {
    actions.push({
      id: 'save_task',
      label: '保存为今晚任务',
      kind: 'task',
      payload: { seedText: fullText.slice(0, 48), taskTitle },
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

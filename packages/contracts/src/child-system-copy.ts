/** 系统 UI 里指「自家孩子」的文案 · 用 onboarding 昵称替换泛称「孩子」 */

export function resolveChildDisplayName(name?: string | null): string {
  const n = (name || '').trim()
  return n && n !== '孩子' ? n : '孩子'
}

export function childSystemCopy(name?: string | null) {
  const n = resolveChildDisplayName(name)
  return {
    inSceneMemory: `系统记忆 · 此场景下的${n}`,
    simulatingReaction: `正在模拟本场景下${n}的反应…`,
    triggerEasily: `${n}最容易被触发的是`,
    reactionQuestion: `${n}的反应？`,
    supplementReaction: `补充${n}反应或一句备注`,
    saveSupplement: '保存补充',
    supplementSaved: '补充已保存',
    editChildInfo: `编辑${n}信息`,
    behaviorPattern: `${n}行为模式`,
    homeworkMechanism: `${n}写作业的机制`,
    growthTension: `${n}健康成长阻力`,
    statusLoosen: `当前状态：${n}开始谈条件，有一点松动`,
    statusDefensive: `当前状态：${n}仍有防御，需要先降压力`,
    speakInScene: (sceneTitle: string) => `在「${sceneTitle}」场景里把话说到${n}听得进去`,
    rehearsalDisclaimer: `这里不是预测${n}一定会这样说，而是基于已有记录，帮你提前看见可能的沟通走向。`,
    insightLede: (cardCount: number) =>
      `${cardCount} 张卡片，读懂${n}与亲子互动。不是报告墙——是手账里慢慢写厚的理解。`,
    expandFeedback: '展开反馈',
    collapseFeedback: '收起',
    buildPortrait: `建立${n}画像`,
    childMayHearFirst: `${n}可能先听成`,
    dialogueCaptureHint: `长按录音转写，或把对话文字粘贴进来；我们会结合${n}画像标出值得留意的句子。`,
    portraitShareTitle: `育见 · ${n}画像`,
    deepMechanismLede: `下面用家长能听懂的话说清：家里常见动作如何触发${n}反应，又怎样绕回下一轮。`,
  } as const
}

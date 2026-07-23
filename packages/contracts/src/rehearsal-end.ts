/** L4 预演结束页 · 家长可见文案（MP/Web 共享） */

export type RehearsalEndFields = {
  closingAdvice?: string
  whyThisIsSafer?: string
  childLikelyHearing?: string
  riskPoints?: string[]
  saferVersion?: string
  suggestedWording?: string
  taskTitle?: string
}

export type RehearsalEndCopy = {
  summary: string
  trigger: string
  tryTonight: string
  archiveNote: string
}

const ARCHIVE_NOTE =
  '预演里的孩子反应只是模拟，不等于真实证据。只有你今晚真的试了，并反馈孩子实际怎么反应，才会更新档案。'

export function getRehearsalEndCopy(endData: RehearsalEndFields | null | undefined): RehearsalEndCopy {
  return {
    summary:
      endData?.closingAdvice?.trim() ||
      endData?.whyThisIsSafer?.trim() ||
      '先减少「被站在旁边看着」的感觉，再谈开始。你越想把时间说清楚，他越先听到的是「你又要管我」。',
    trigger:
      endData?.childLikelyHearing?.trim() ||
      endData?.riskPoints?.[0]?.trim() ||
      '当你解释「我是怕你拖到很晚」，或者说「你每次都拖」时，孩子容易听成：你还是在盯他、评价他。',
    tryTonight:
      endData?.saferVersion?.trim() ||
      endData?.suggestedWording?.trim() ||
      '今晚如果又卡在作业开始前，可以先让孩子自己选第一项，你暂时离开十分钟。',
    archiveNote: ARCHIVE_NOTE,
  }
}

/** 预演结束 → 任务/手账准入：标题须 ≥8 字实质内容 */
export function pickRehearsalTaskTitle(endData: RehearsalEndFields | null | undefined, fallback = ''): string {
  const candidates = [endData?.taskTitle, endData?.saferVersion, endData?.suggestedWording, fallback]
  for (const c of candidates) {
    const t = String(c || '').trim()
    if (t.length >= 8) return t
  }
  return candidates.map((c) => String(c || '').trim()).find(Boolean) || ''
}

export function rehearsalEndHandbookEligible(endData: RehearsalEndFields | null | undefined): boolean {
  return pickRehearsalTaskTitle(endData).length >= 8
}

/** 提交硬门槛（仅防空提交） */
export const ENTRY_SUBMIT_MIN_CHARS = 2

/** UI 软引导：开始鼓励写细 */
export const ENTRY_CAPTURE_HINT_CHARS = 300

/** 隐性放行线：场景够密时约可进 summary */
export const ENTRY_CAPTURE_RELEASE_CHARS = 400

/** 场景仍薄时继续追到这一档 */
export const ENTRY_CAPTURE_STRETCH_CHARS = 550

const LABEL_WORDS = [
  '懒',
  '不自觉',
  '沉迷',
  '没内驱',
  '叛逆',
  '不听话',
  '不懂事',
  '骗我',
  '没救了',
  '贪玩',
  '拖拉',
]

const SCENE_WORDS = [
  '有一次',
  '昨天',
  '今天',
  '晚上',
  '放学',
  '作业',
  '手机',
  '提醒',
  '他说',
  '我说',
  '后来',
  '最后',
  '吵',
  '检查',
  '考',
  '哭',
  '烦',
  '爸爸',
  '妈妈',
  '同学',
  '老师',
  '几点',
  '小时',
  '分钟',
  '回房间',
  '顶嘴',
  '该写',
  '睡觉',
]

export function countEntrySceneMarkers(text: string): number {
  return SCENE_WORDS.filter((w) => text.includes(w)).length
}

/** 评价词多、现场细节少 */
export function isMostlyParentLabels(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const labelHits = LABEL_WORDS.filter((w) => t.includes(w)).length
  const sceneHits = countEntrySceneMarkers(t)
  if (sceneHits >= 4) return false
  if (labelHits >= 2 && sceneHits < 3) return true
  if (labelHits >= 1 && sceneHits < 2 && t.length < 150) return true
  if (t.length >= 200 && sceneHits < 3 && labelHits >= 1) return true
  return false
}

/** 材料够进阶段总结（偏紧：120 字不能过） */
export function isEntryCaptureUsable(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (isMostlyParentLabels(t)) return false
  const scene = countEntrySceneMarkers(t)
  if (t.length >= ENTRY_CAPTURE_RELEASE_CHARS && scene >= 4) return true
  if (t.length >= ENTRY_CAPTURE_STRETCH_CHARS && scene >= 3) return true
  if (t.length >= 600 && scene >= 2) return true
  return false
}

export type EntryFollowUpQualityBand =
  | 'very_short'
  | 'below_release'
  | 'stretch'
  | 'long_but_thin'
  | 'release'

export function evaluateEntryFollowUpGate(rawText: string): {
  charCount: number
  sceneMarkers: number
  mostlyLabels: boolean
  qualityBand: EntryFollowUpQualityBand
  /** 代码层强制 shouldAsk=true（仍不挡提交） */
  forceShouldAsk: boolean
  /** 场景+字数已够，可直接 shouldAsk=false */
  releaseWithoutLlm: boolean
} {
  const t = rawText.trim()
  const charCount = t.length
  const sceneMarkers = countEntrySceneMarkers(t)
  const mostlyLabels = isMostlyParentLabels(t)
  const releaseWithoutLlm = isEntryCaptureUsable(t)

  let qualityBand: EntryFollowUpQualityBand = 'release'
  if (!releaseWithoutLlm) {
    if (charCount < 200) qualityBand = 'very_short'
    else if (charCount < ENTRY_CAPTURE_RELEASE_CHARS) qualityBand = 'below_release'
    else if (charCount < ENTRY_CAPTURE_STRETCH_CHARS) qualityBand = 'stretch'
    else qualityBand = 'long_but_thin'
  }

  const forceShouldAsk =
    !releaseWithoutLlm &&
    (charCount < ENTRY_CAPTURE_RELEASE_CHARS ||
      (mostlyLabels && charCount < 600) ||
      (charCount < ENTRY_CAPTURE_STRETCH_CHARS && sceneMarkers < 4))

  return {
    charCount,
    sceneMarkers,
    mostlyLabels,
    qualityBand,
    forceShouldAsk,
    releaseWithoutLlm,
  }
}

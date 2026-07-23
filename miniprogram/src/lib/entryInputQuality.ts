/** 与 src/lib/entry-input-quality.ts 保持同步（小程序 bundle 不引用根 src） */

export const ENTRY_SUBMIT_MIN_CHARS = 2
export const ENTRY_CAPTURE_HINT_CHARS = 300
export const ENTRY_CAPTURE_RELEASE_CHARS = 400
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

export function evaluateEntryFollowUpGate(rawText: string) {
  const t = rawText.trim()
  const charCount = t.length
  const sceneMarkers = countEntrySceneMarkers(t)
  const mostlyLabels = isMostlyParentLabels(t)
  const releaseWithoutLlm = isEntryCaptureUsable(t)

  let qualityBand: 'very_short' | 'below_release' | 'stretch' | 'long_but_thin' | 'release' = 'release'
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

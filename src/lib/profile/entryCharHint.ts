/** 采集页字数提示：鼓励补充，不设硬门槛 */
export function getEntryCaptureCharHint(charCount: number): string | null {
  if (charCount === 0) return null
  if (charCount < 40) {
    return '想到哪说到哪就好；多讲一点当时原话，后面整理会更贴（没有字数要求）。'
  }
  if (charCount < 120) {
    return '这些已经能用了。想继续补充也可以，不补也能先提交。'
  }
  return null
}

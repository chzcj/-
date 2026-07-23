/** 采集页动态字数提示目标（软引导，非提交硬门槛） */
export const ENTRY_CAPTURE_TARGET_CHARS = 300

/** 采集/追问页字数提示：与 Web entryCharHint 一致 */
export function getEntryCaptureCharHint(charCount: number): string | null {
  if (charCount === 0) return null
  if (charCount < 80) {
    return '可以多写一点：打字建议 300 字以上；按住说话最长约 1 分钟，把原话、时间点、孩子怎么回都讲出来。'
  }
  if (charCount < ENTRY_CAPTURE_TARGET_CHARS) {
    return '已经在路上了。再补一点细节（谁说了什么、几点发生、最后怎么收场），后面整理会更准。'
  }
  if (charCount < 450) {
    return '这些细节已经不错。想到别的场景或原话，也可以继续补充。'
  }
  return null
}

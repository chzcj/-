/** 采集页鼓励家长写细的目标字数（软引导，非提交硬门槛） */
export const ENTRY_CAPTURE_TARGET_CHARS = 300

/** 模块阶段总结 mainJudgment 目标字数（由 SP + LLM 产出） */
export const ENTRY_SUMMARY_MAIN_JUDGMENT_TARGET_CHARS = 450

/** 采集页字数提示：鼓励补充，不设硬门槛（与小程序 entryCharHint 一致） */
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

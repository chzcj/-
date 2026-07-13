import 'server-only'

const REACTION_MARKER = '---reaction---'
const REST_MARKER = '---rest---'
// LLM 可能输出 ---rest--- 或 ---rest（少尾部 ---），用前缀匹配更健壮
const REST_MARKER_PREFIX = '---rest'

/** Rehearsal marker 流式解析器：LLM 输出 `---reaction---\\n孩子回复\\n---rest---\\n{JSON}`。
 *  reaction 段逐字流式回调，rest 段累积等流结束解析 JSON。 */
export function createRehearsalStreamTracker(callbacks: {
  onReactionDelta?: (delta: string) => void
}) {
  let full = ''
  let reactionDone = false
  let reactionText = ''
  let restRaw = ''

  function feed(delta: string) {
    full += delta
    if (!reactionDone) {
      const restIdx = full.indexOf(REST_MARKER_PREFIX)
      if (restIdx >= 0) {
        const reactionPart = full.slice(0, restIdx)
        const cleaned = stripReactionMarker(reactionPart).replace(/\n*---+\s*$/m, '')
        const inc = cleaned.slice(reactionText.length)
        if (inc) {
          reactionText = cleaned
          callbacks.onReactionDelta?.(inc)
        }
        reactionDone = true
        let afterMarker = full.slice(restIdx + REST_MARKER_PREFIX.length)
        afterMarker = afterMarker.replace(/^---?\s*\n?/, '')
        restRaw = afterMarker
      } else {
        const cleaned = stripReactionMarker(full).replace(/\n*---+\s*$/m, '')
        const inc = cleaned.slice(reactionText.length)
        if (inc) {
          reactionText = cleaned
          callbacks.onReactionDelta?.(inc)
        }
      }
    } else {
      restRaw += delta
    }
  }

  function finalize(): { reaction: string; restJson: Record<string, unknown> | null } {
    // 若流结束仍无 rest marker，把全部当 reaction
    if (!reactionDone) {
      reactionText = stripReactionMarker(full)
    }
    // 清理 reaction 末尾可能残留的 --- 分隔符
    reactionText = reactionText.replace(/\n*---+\s*$/m, '').trim()
    let restJson: Record<string, unknown> | null = null
    const trimmed = restRaw.trim()
    if (trimmed) {
      try {
        restJson = JSON.parse(trimmed)
      } catch {
        restJson = null
      }
    }
    return { reaction: reactionText, restJson }
  }

  return { feed, finalize }
}

function stripReactionMarker(text: string): string {
  const idx = text.indexOf(REACTION_MARKER)
  if (idx < 0) return ''
  return text.slice(idx + REACTION_MARKER.length)
}

/** LLM prompt：要求 marker 流式输出 reaction + rest JSON */
export function buildRehearsalStreamTask(): string {
  return `先输出孩子听到家长话后可能说出口的回复，再输出其余分析 JSON。

输出格式（严格）：
---reaction---
孩子即时回复（对话体，可用引号，40-120字，禁止写成给家长的建议；先像这个孩子平时说话——复用孩子原话样本的用词句式、可提及锚定事实里的具体近期事件；机制只作潜台词不直说；若有本场前文须接住）
---rest---
{ "childLikelyHearing": string, "likelyTriggeredMechanisms": string[], "possibleChildReaction": { "immediateReaction": string, "innerReaction": string, "behaviorRisk": string }, "riskPoints": string[], "saferVersion": string, "whyThisIsSafer": string, "avoidPhrases": string[], "usedProfileEvidence": string[], "closingAdvice": string, "taskTitle": string, "dailyToneDetected": boolean, "dailyToneReminder": string, "showSuggestedWording": boolean, "suggestedWordingHint": string }

规则：
- ---reaction--- 段只写孩子可能说出口的话，不写分析。
- ---rest--- 段必须是合法 JSON（可跨多行），包含其余所有字段。
- immediateReaction 字段与 ---reaction--- 段内容一致。
- usedProfileEvidence 至少列出 1 条本轮用到的画像/证据要点。
- 禁止输出 markdown 标题、解释性前后缀。`
}

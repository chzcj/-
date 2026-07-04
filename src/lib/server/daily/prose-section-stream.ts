import 'server-only'

import type { OrchestrationOutput } from '@/types/database'
import type { DailySection } from '@/types/daily-message'
import { buildDailyProsePayload, buildDailyProseTask, clampProse, resolveProseMode } from '@/lib/server/daily/prose-context'
import { requireTextStream } from '@/lib/server/daily/llm-required'
import { agentPrompts } from '@/lib/server/agent-prompts'
import {
  createSectionStreamTracker,
  type SectionStreamCallbacks,
} from '@/lib/server/daily/section-stream'

const SECTION_MARKER_PREFIX = '---section:'

/** 合并 system：parentFacingStyle + dailyDialogueOrchestration + parentFacingCopy（style 只出现一次）。
 *  稳定前缀，便于 provider 侧 prompt cache 命中。 */
function combinedProseAndSectionSystem(): string {
  return `${agentPrompts.parentFacingStyle}\n\n---\n\n${agentPrompts.dailyDialogueOrchestration}\n\n---\n\n${agentPrompts.parentFacingCopy}`
}

/** 合并 task：先输出 prose 正文，再按 marker 输出 sections + taskTitle */
function buildProseAndSectionTask(output: OrchestrationOutput, skeletons: DailySection[]): string {
  const proseTask = buildDailyProseTask(output)
  if (!skeletons.length) {
    // 无 visible section：只输出 prose，不要求 marker
    return `${proseTask}\n\n本轮不输出 section，只输出上面这段正文。`
  }
  const order = skeletons.map((s) => s.id).join(' → ')
  return `${proseTask}

接下来，在同一输出里继续生成 section 正文（不要重新开场）：
每个 section 必须以单独一行标记开始：---section:{id}---
标记后只写该 section 正文（段落用空行分隔；列表项每行以 - 开头）。
全部 section 结束后，另起一行写 ---task---，下一行写 taskTitle（6-24 字祈使句，供「今晚任务」使用）。
section 顺序必须为：${order}
禁止输出 markdown 标题、JSON、或任何解释性前后缀。`
}

export type ProseAndSectionCallbacks = {
  onProseDelta?: (delta: string) => void
  onProseComplete?: () => void
  onSectionError?: (id: string, message: string) => void
} & SectionStreamCallbacks

/** 一次 LLM 调用流式输出 prose + sections。
 *  收益：消除 prose 与 section 两次 LLM 并发到 provider 的排队等待（实测 prose 完成后
 *  section 首字要再等 7.6s），prose 完成后 section marker 紧接流式，真正无缝衔接。
 *  顺序天然保证：LLM 先输出 prose，再按 visibleSkeletons 顺序输出 section marker + 内容，
 *  前台可见 section 永远在 hidden（hidden 由 fillDailySectionCopy 并行预取）之前。 */
export async function streamProseAndSections(
  output: OrchestrationOutput,
  userText: string,
  visibleSkeletons: DailySection[],
  callbacks: ProseAndSectionCallbacks
): Promise<{ prose: string; sections: DailySection[]; taskTitle?: string }> {
  const payload = buildDailyProsePayload(output, userText)
  const task = buildProseAndSectionTask(output, visibleSkeletons)
  const sectionTracker = visibleSkeletons.length
    ? createSectionStreamTracker(visibleSkeletons, callbacks)
    : null

  let full = ''
  let proseDone = false
  let proseSent = 0
  let proseText = ''

  await requireTextStream(
    combinedProseAndSectionSystem(),
    task,
    {
      ...payload,
      sectionSkeletons: visibleSkeletons.map((s) => ({ id: s.id, label: s.label, kind: s.kind, hidden: s.hidden })),
    },
    (delta) => {
      if (proseDone) {
        sectionTracker?.feed(delta)
        return
      }
      full += delta
      const markerIdx = full.indexOf(SECTION_MARKER_PREFIX)
      if (markerIdx >= 0) {
        proseText = full.slice(0, markerIdx)
        const inc = proseText.slice(proseSent)
        if (inc) callbacks.onProseDelta?.(inc)
        proseSent = proseText.length
        callbacks.onProseComplete?.()
        proseDone = true
        sectionTracker?.feed(full.slice(markerIdx))
      } else {
        // prose 阶段：发增量，缓冲末尾 20 char 防止 marker 片段被当 prose 发
        const safeEnd = Math.max(0, full.length - 20)
        if (safeEnd > proseSent) {
          callbacks.onProseDelta?.(full.slice(proseSent, safeEnd))
          proseSent = safeEnd
        }
      }
    },
    { maxTokens: 3072 }
  )

  if (!proseDone) {
    // 流结束仍无 marker：全部当 prose
    proseText = full
    const inc = proseText.slice(proseSent)
    if (inc) callbacks.onProseDelta?.(inc)
    callbacks.onProseComplete?.()
    return { prose: clampProse(proseText, resolveProseMode(output)), sections: visibleSkeletons, taskTitle: undefined }
  }

  if (!sectionTracker) {
    return { prose: clampProse(proseText, resolveProseMode(output)), sections: [], taskTitle: undefined }
  }

  try {
    const result = sectionTracker.finalize()
    return { prose: clampProse(proseText, resolveProseMode(output)), sections: result.sections, taskTitle: result.taskTitle }
  } catch (err) {
    // 部分 section 缺失：对缺失的发 onSectionError，已完成的保留
    const message = err instanceof Error ? err.message : '这部分未生成'
    const completed = new Set<string>()
    // finalize 失败时无法拿到已完成列表，回退：对每个未在 fullText 中出现的 section 发 error
    for (const sk of visibleSkeletons) {
      if (!full.includes(`---section:${sk.id}---`)) {
        callbacks.onSectionError?.(sk.id, message)
      } else {
        completed.add(sk.id)
      }
    }
    // 返回骨架（已完成的由前端 section_complete 事件保留，这里只补缺失的骨架）
    return { prose: clampProse(proseText, resolveProseMode(output)), sections: visibleSkeletons, taskTitle: undefined }
  }
}

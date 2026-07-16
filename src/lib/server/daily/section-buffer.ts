import 'server-only'

import type { OrchestrationOutput } from '@/types/database'
import type { DailySection } from '@/types/daily-message'
import { buildDailyProsePayload } from '@/lib/server/daily/prose-context'
import { requireTextStream } from '@/lib/server/daily/llm-required'
import { frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { sectionCopySystem } from '@/lib/server/daily/parent-facing-copy'
import { mergeSectionCopy, rawTextToPatch } from '@/lib/server/daily/section-stream'

export type SectionBuffer = {
  skeleton: DailySection
  chunks: string[]
  fullText: string
  done: boolean
  error: Error | null
}

export type SectionFlushCallbacks = {
  onSectionStart?: (section: DailySection) => void
  onSectionDelta?: (id: string, text: string) => void
  onSectionComplete?: (section: DailySection) => void
  onSectionError?: (id: string, message?: string) => void
}

// 主流程已切单次 marker 流式（streamDailySectionCopy，无节流）；本文件仅 retry 单 section 重试用，
// pacing 默认 0（保留 rAF 微让步，无人工延迟）。
const SECTION_DELTA_PACE_MS = Number(process.env.SECTION_DELTA_PACE_MS || 0)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function emitPacedDeltas(
  buffer: SectionBuffer,
  callbacks: SectionFlushCallbacks,
  skeletonId: string,
  startEmitted: number,
  startAcc: string
): Promise<{ emitted: number; acc: string }> {
  let emitted = startEmitted
  let acc = startAcc

  while (emitted < buffer.chunks.length) {
    acc += buffer.chunks[emitted]
    emitted += 1
    callbacks.onSectionDelta?.(skeletonId, acc)
    if (emitted < buffer.chunks.length) {
      await sleep(SECTION_DELTA_PACE_MS)
    }
  }

  return { emitted, acc }
}

/** 并行预生成：prose 流式期间后台填充 buffer，不推前端 */
export function startSectionBufferPrefetch(
  skeleton: DailySection,
  output: OrchestrationOutput,
  userText: string
): SectionBuffer {
  const buffer: SectionBuffer = {
    skeleton,
    chunks: [],
    fullText: '',
    done: false,
    error: null,
  }

  void (async () => {
    try {
      const payload = buildDailyProsePayload(output, userText)
      const task = buildSingleSectionTask(skeleton)
      buffer.fullText = await requireTextStream(
        sectionCopySystem(),
        task,
        {
          ...payload,
          sectionSkeleton: {
            id: skeleton.id,
            label: skeleton.label,
            kind: skeleton.kind,
            hidden: skeleton.hidden,
          },
        },
        (delta) => {
          buffer.chunks.push(delta)
          buffer.fullText += delta
        },
        { disableThinking: frontAiThinkingDisabled() }
      )
      buffer.done = true
    } catch (err: unknown) {
      buffer.error = err instanceof Error ? err : new Error(String(err))
      buffer.done = true
    }
  })()

  return buffer
}

/** prose_complete 后按序放流：块内逐字（真 delta 回放 + 尾部 live） */
export async function flushSectionBuffer(
  buffer: SectionBuffer,
  callbacks: SectionFlushCallbacks
): Promise<DailySection | null> {
  const { skeleton } = buffer
  callbacks.onSectionStart?.({ ...skeleton, streamingText: '' })

  let emitted = 0
  let acc = ''

  while (true) {
    const before = emitted
    const paced = await emitPacedDeltas(buffer, callbacks, skeleton.id, emitted, acc)
    emitted = paced.emitted
    acc = paced.acc

    if (buffer.done && emitted >= buffer.chunks.length) break
    if (emitted === before && !buffer.done) {
      await sleep(24)
    }
  }

  if (buffer.error || !buffer.fullText.trim()) {
    callbacks.onSectionError?.(skeleton.id, '这部分未生成')
    return null
  }

  try {
    const section = mergeSectionCopy(skeleton, rawTextToPatch(skeleton, buffer.fullText))
    callbacks.onSectionComplete?.(section)
    return section
  } catch (err) {
    callbacks.onSectionError?.(skeleton.id, err instanceof Error ? err.message : '这部分未生成')
    return null
  }
}

export async function flushSectionBuffersSequential(
  buffers: SectionBuffer[],
  callbacks: SectionFlushCallbacks
): Promise<DailySection[]> {
  const completed: DailySection[] = []
  for (const buffer of buffers) {
    const section = await flushSectionBuffer(buffer, callbacks)
    if (section) completed.push(section)
  }
  return completed
}

/** 单 section 重试（Q11-B） */
export async function retrySectionCopy(
  skeleton: DailySection,
  output: OrchestrationOutput,
  userText: string,
  callbacks: SectionFlushCallbacks
): Promise<DailySection | null> {
  const buffer: SectionBuffer = {
    skeleton,
    chunks: [],
    fullText: '',
    done: false,
    error: null,
  }

  try {
    const payload = buildDailyProsePayload(output, userText)
    const task = buildSingleSectionTask(skeleton)
    await requireTextStream(
      sectionCopySystem(),
      task,
      {
        ...payload,
        sectionSkeleton: {
          id: skeleton.id,
          label: skeleton.label,
          kind: skeleton.kind,
          hidden: skeleton.hidden,
        },
      },
      (delta) => {
        buffer.chunks.push(delta)
        buffer.fullText += delta
      },
      { disableThinking: frontAiThinkingDisabled() }
    )
    buffer.done = true
  } catch (err) {
    buffer.error = err instanceof Error ? err : new Error(String(err))
    buffer.done = true
  }

  return flushSectionBuffer(buffer, callbacks)
}

export function buildSingleSectionTask(skeleton: DailySection): string {
  const kindHint =
    skeleton.kind === 'list'
      ? '列表项每行以 - 开头。'
      : skeleton.kind === 'quotes'
        ? '每行一句孩子内心话，不要加引号编号。'
        : skeleton.kind === 'mixed'
          ? '先短段落，再 - 列表项（如有）。'
          : '段落用空行分隔。'

  return `为 section「${skeleton.label}」（id=${skeleton.id}，kind=${skeleton.kind}）生成家长可见正文。
只输出正文，不要 JSON、不要 markdown 标题、不要解释前后缀。
${kindHint}`
}

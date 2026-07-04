import 'server-only'

import { createHash } from 'node:crypto'
import type { OrchestrationOutput } from '@/types/database'
import type { DailySection } from '@/types/daily-message'
import { agentPrompts } from '@/lib/server/agent-prompts'
import { buildDailyProsePayload } from '@/lib/server/daily/prose-context'
import {
  assertParentFacingText,
  filterParentFacingList,
} from '@/lib/server/daily/parent-facing-filter'
import { requireFastJson, requireTextStream } from '@/lib/server/daily/llm-required'
import {
  buildSectionStreamTask,
  createSectionStreamTracker,
  type SectionStreamCallbacks,
} from '@/lib/server/daily/section-stream'

type SectionCopyPatch = {
  id: string
  paragraphs?: string[]
  items?: string[]
  quotes?: string[]
  note?: string
}

type SectionCopyResponse = {
  sections?: SectionCopyPatch[]
  /** 同次 LLM 提炼的「今晚任务」标题（祈使句式，≤24 字），供 task action 直接使用，避免前端截原话。 */
  taskTitle?: string
}

const PROMPT_CACHE_VERSION = 'parent-facing-v6-trim-sp'

function stableHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

export function sectionCopySystem(): string {
  return `${agentPrompts.parentFacingStyle}\n\n---\n\n${agentPrompts.parentFacingCopy}`
}

function mergeSectionCopy(skeleton: DailySection, patch: SectionCopyPatch): DailySection {
  const next: DailySection = { ...skeleton }

  if (patch.paragraphs?.length) {
    next.paragraphs = patch.paragraphs.map((p, i) => assertParentFacingText(p, `${skeleton.id}.p${i}`))
  }
  if (patch.items?.length) {
    next.items = filterParentFacingList(patch.items, `${skeleton.id}.items`)
  }
  if (patch.quotes?.length) {
    next.quotes = patch.quotes.map((q, i) =>
      assertParentFacingText(q.replace(/^["「]|["」]$/g, ''), `${skeleton.id}.q${i}`)
    )
  }
  if (patch.note?.trim()) {
    next.note = assertParentFacingText(patch.note, `${skeleton.id}.note`)
  }

  const hasContent =
    (next.paragraphs?.length || 0) > 0 ||
    (next.items?.length || 0) > 0 ||
    (next.quotes?.length || 0) > 0

  if (!hasContent && !next.hidden) {
    throw new Error(`PARENT_FACING_SECTION_EMPTY:${skeleton.id}`)
  }

  return next
}

/** 强制 LLM 填充所有 section 正文（无规则兜底）。同时同次输出 taskTitle 供任务卡片使用。 */
export async function fillDailySectionCopy(
  skeletons: DailySection[],
  output: OrchestrationOutput,
  userText: string
): Promise<{ sections: DailySection[]; taskTitle?: string }> {
  if (!skeletons.length) return { sections: skeletons }

  const payload = buildDailyProsePayload(output, userText)
  const task =
    '根据 sectionSkeletons 为每个 section 生成家长可见正文。只输出 JSON：{ "sections": [{ "id", "paragraphs"?, "items"?, "quotes"?, "note"? }], "taskTitle"?: "..." }'

  const result = await requireFastJson<SectionCopyResponse>(
    sectionCopySystem(),
    {
      task,
      ...payload,
      sectionSkeletons: skeletons.map((s) => ({ id: s.id, label: s.label, kind: s.kind, hidden: s.hidden })),
    },
    {
      // section 文案常因 2048 默认值在段落中途截断（如"…交流发生在他…"），提到 3072 给足空间。
      maxTokens: 2048,
    }
  )

  const patches = result.sections || []
  const byId = new Map(patches.map((p) => [p.id, p]))

  const sections = skeletons.map((sk) => {
    const patch = byId.get(sk.id)
    if (!patch) throw new Error(`PARENT_FACING_SECTION_MISSING:${sk.id}`)
    return mergeSectionCopy(sk, patch)
  })

  const taskTitle = (result.taskTitle || '').trim()
  return { sections, taskTitle: taskTitle || undefined }
}

/** 单个 section 真流式（Plan P 并行 buffer 用） */
export async function streamSingleSectionCopy(
  skeleton: DailySection,
  output: OrchestrationOutput,
  userText: string,
  onDelta?: (delta: string) => void
): Promise<string> {
  const payload = buildDailyProsePayload(output, userText)
  const { buildSingleSectionTask } = await import('@/lib/server/daily/section-buffer')
  const task = buildSingleSectionTask(skeleton)

  return requireTextStream(
    sectionCopySystem(),
    task,
    {
      ...payload,
      sectionSkeleton: { id: skeleton.id, label: skeleton.label, kind: skeleton.kind, hidden: skeleton.hidden },
    },
    onDelta
  )
}

/** 单流 marker 格式填充可见 section（legacy fallback） */
export async function streamDailySectionCopy(
  skeletons: DailySection[],
  output: OrchestrationOutput,
  userText: string,
  callbacks: SectionStreamCallbacks
): Promise<{ sections: DailySection[]; taskTitle?: string }> {
  if (!skeletons.length) return { sections: skeletons }

  const payload = buildDailyProsePayload(output, userText)
  const task = buildSectionStreamTask(skeletons)
  const tracker = createSectionStreamTracker(skeletons, callbacks)

  await requireTextStream(sectionCopySystem(), task, {
    ...payload,
    sectionSkeletons: skeletons.map((s) => ({ id: s.id, label: s.label, kind: s.kind, hidden: s.hidden })),
  }, (delta) => {
    tracker.feed(delta)
  })

  return tracker.finalize()
}

/** 段落完整性校验：禁止 LLM 停在半句（如"…交流发生在他…"）。末尾必须是句号/问号/感叹号/闭合引号。 */
function validateSectionCompleteness(raw: SectionCopyResponse): void {
  for (const s of raw.sections || []) {
    for (const p of s.paragraphs || []) {
      const t = (p || '').trim()
      if (!t) continue
      const last = t[t.length - 1]
      if (!/[。！？!?）」』"]$/.test(last)) {
        throw new Error(`PARENT_FACING_SECTION_INCOMPLETE:${s.id}`)
      }
    }
  }
}

export function combinedProseSystem(): string {
  return `${agentPrompts.parentFacingStyle}\n\n---\n\n${agentPrompts.dailyDialogueOrchestration}`
}

export function parentFacingPromptCacheInfo() {
  const proseSystem = combinedProseSystem()
  const sectionSystem = sectionCopySystem()

  return {
    strategy: 'stable_system_prefix_dynamic_user_payload',
    version: PROMPT_CACHE_VERSION,
    proseSystemHash: stableHash(proseSystem),
    sectionSystemHash: stableHash(sectionSystem),
    dynamicPayload: 'userText/retrievalPack/sectionSkeletons',
  }
}

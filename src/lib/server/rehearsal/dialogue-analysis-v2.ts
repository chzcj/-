import type {
  DialogueAnalysisV2,
  DialogueAnalysisSegment,
  DialoguePhase,
  DialoguePhaseQuote,
  DialogueSampleLine,
  DialogueTryTonightStep,
} from '@yujian/contracts/rehearsal-dialogue'

export type DialogueAnalysisRecordLike = {
  summary: string
  analysis: string
  tryTonight: string
  sampleDialogue: string
  segments: DialogueAnalysisSegment[]
  rehearsalSeed?: Record<string, unknown>
}

export type DialogueAnalysisLlmV2 = {
  insufficient?: boolean
  friendlyMessage?: string
  summary?: string
  synthesis?: string
  meta?: {
    sceneLabel?: string
    durationHint?: string
    totalQuoteCount?: number
    phaseCount?: number
    highlightCount?: number
  }
  dossierCells?: Array<{ label?: string; body?: string }>
  phases?: Array<{
    title?: string
    timeRange?: string
    quoteCountHint?: string
    profileMatch?: string
    quotes?: Array<{ speaker?: string; text?: string; isPeak?: boolean }>
  }>
  tryTonightSteps?: Array<{ label?: string; text?: string }>
  sampleScene?: string
  sampleLines?: Array<{ role?: string; text?: string; stageDirection?: string }>
  segments?: Array<{ speaker?: string; text?: string; highlight?: boolean; highlightReason?: string }>
  tryTonight?: string
  sampleDialogue?: string
  rehearsalSeed?: {
    sceneTitle?: string
    sceneSummary?: string
    openingHint?: string
  }
}

function clampSpeaker(raw: string | undefined): '家长' | '孩子' {
  return raw === '孩子' ? '孩子' : '家长'
}

function normalizeProfileMatch(raw: string | undefined): string {
  const t = String(raw || '').trim()
  if (!t) return '画像对照：结合这段对话里的反应来看'
  if (t.startsWith('画像对照')) return t
  return `画像对照：${t.replace(/^↔\s*/, '')}`
}

function normalizePhases(raw: DialogueAnalysisLlmV2['phases']): DialoguePhase[] {
  const phases = (raw || [])
    .map((p) => {
      const quotes: DialoguePhaseQuote[] = (p.quotes || [])
        .map((q) => ({
          speaker: clampSpeaker(q.speaker),
          text: String(q.text || '').trim(),
          isPeak: Boolean(q.isPeak),
        }))
        .filter((q) => q.text.length > 0)
      const title = String(p.title || '').trim()
      const timeRange = String(p.timeRange || '').trim()
      const fullTitle =
        title && timeRange && !title.includes('（') ? `${title}（${timeRange}）` : title || timeRange
      return {
        title: fullTitle,
        timeRange: timeRange || undefined,
        quoteCountHint: p.quoteCountHint?.trim() || (quotes.length ? `${quotes.length} 句` : undefined),
        profileMatch: normalizeProfileMatch(p.profileMatch),
        quotes,
      } satisfies DialoguePhase
    })
    .filter((p) => p.title && p.quotes.length > 0)

  if (phases.length >= 2) return phases.slice(0, 5)

  // 合并过少分段：若 LLM 只给 1 段，保留
  return phases
}

function mergeThinPhases(phases: DialoguePhase[]): DialoguePhase[] {
  if (phases.length <= 1) return phases
  const merged: DialoguePhase[] = []
  for (const phase of phases) {
    const prev = merged[merged.length - 1]
    if (prev && prev.quotes.length < 2 && phase.quotes.length < 2) {
      prev.quotes.push(...phase.quotes)
      prev.quoteCountHint = `${prev.quotes.length} 句`
      prev.title = `${prev.title} → ${phase.title}`.slice(0, 120)
      prev.profileMatch = prev.profileMatch || phase.profileMatch
    } else {
      merged.push({ ...phase, quotes: [...phase.quotes] })
    }
  }
  return merged.length >= 2 ? merged.slice(0, 5) : phases
}

function capHighlights(phases: DialoguePhase[], maxTotal = 10): DialoguePhase[] {
  let count = 0
  return phases.map((phase) => {
    const quotes = phase.quotes.filter((q: DialoguePhaseQuote) => {
      if (count >= maxTotal) return false
      count += 1
      return true
    })
    return {
      ...phase,
      quotes,
      quoteCountHint: quotes.length ? `${quotes.length} 句` : phase.quoteCountHint,
    }
  }).filter((p) => p.quotes.length > 0)
}

export function normalizeDialogueAnalysisV2(
  llm: DialogueAnalysisLlmV2,
  fallbackSummary: string
): DialogueAnalysisV2 {
  const dossierCells = (llm.dossierCells || [])
    .map((c) => ({
      label: String(c.label || '').trim(),
      body: String(c.body || '').trim(),
    }))
    .filter((c) => c.label && c.body)
    .slice(0, 4)

  let phases = capHighlights(mergeThinPhases(normalizePhases(llm.phases)), 10)
  if (phases.length < 2 && (llm.segments || []).length >= 2) {
    phases = legacyPhasesFromSegments(normalizeSegments(llm.segments))
  }

  const tryTonightSteps = (llm.tryTonightSteps || [])
    .map((s, i) => ({
      label: String(s.label || '').trim() || `第 ${i + 1} 步`,
      text: String(s.text || '').trim(),
    }))
    .filter((s) => s.text.length > 8)
    .slice(0, 3)

  const sampleLines = (llm.sampleLines || [])
    .map((l) => ({
      role: clampSpeaker(l.role),
      text: String(l.text || '').trim(),
      stageDirection: l.stageDirection?.trim() || undefined,
    }))
    .filter((l) => l.text.length > 0)
    .slice(0, 8)

  const synthesis =
    String(llm.synthesis || llm.summary || fallbackSummary || '').trim() ||
    '这段对话里有一些值得留意的节奏变化，下面按场景地图拆开来看。'

  const totalQuotes = phases.reduce((n, p) => n + p.quotes.length, 0)
  const highlightCount = phases.reduce(
    (n, p) => n + p.quotes.filter((q: DialoguePhaseQuote) => q.isPeak).length,
    0
  )

  return {
    synthesis,
    dossierCells:
      dossierCells.length >= 2
        ? dossierCells
        : [
            { label: '启动前防御', body: '被催容易顶回；需要先稳住节奏再谈开始。' },
            { label: '转换困难', body: '口头答应后仍可能拖延；缓冲活动是在找过渡。' },
          ],
    phases: phases.length >= 2 ? phases : legacyPhasesFromSegments(normalizeSegments(llm.segments)),
    tryTonightSteps:
      tryTonightSteps.length >= 1
        ? tryTonightSteps
        : splitTryTonightSteps(String(llm.tryTonight || '')),
    sampleScene: llm.sampleScene?.trim() || undefined,
    sampleLines:
      sampleLines.length >= 2
        ? sampleLines
        : parseSampleDialogueLines(String(llm.sampleDialogue || '')),
    meta: {
      sceneLabel: llm.meta?.sceneLabel?.trim(),
      durationHint: llm.meta?.durationHint?.trim(),
      totalQuoteCount: llm.meta?.totalQuoteCount ?? totalQuotes,
      phaseCount: llm.meta?.phaseCount ?? phases.length,
      highlightCount: llm.meta?.highlightCount ?? highlightCount,
    },
  }
}

export function normalizeSegments(
  raw: DialogueAnalysisLlmV2['segments']
): DialogueAnalysisSegment[] {
  return (raw || [])
    .map((s) => ({
      speaker: clampSpeaker(s.speaker),
      text: String(s.text || '').trim(),
      highlight: Boolean(s.highlight),
      highlightReason: s.highlightReason,
    }))
    .filter((s) => s.text.length > 0)
}

function legacyPhasesFromSegments(segments: DialogueAnalysisSegment[]): DialoguePhase[] {
  if (!segments.length) {
    return [
      {
        title: '① 对话节选',
        profileMatch: '画像对照：结合这段对话里的反应来看',
        quotes: [{ speaker: '家长', text: '（暂无精选原话）' }],
      },
    ]
  }
  const highlights = segments.filter((s) => s.highlight)
  const pool = (highlights.length >= 2 ? highlights : segments).slice(0, 10)
  const chunk = Math.max(2, Math.ceil(pool.length / 3))
  const phases: DialoguePhase[] = []
  const ORD = ['①', '②', '③', '④', '⑤']
  for (let i = 0; i < pool.length; i += chunk) {
    const slice = pool.slice(i, i + chunk)
    phases.push({
      title: `${ORD[phases.length] || `${phases.length + 1}.`} 节奏段 ${phases.length + 1}`,
      profileMatch: '画像对照：结合这段对话里的反应来看',
      quoteCountHint: `${slice.length} 句`,
      quotes: slice.map((s) => ({
        speaker: clampSpeaker(s.speaker),
        text: s.text,
        isPeak: Boolean(s.highlight),
      })),
    })
  }
  return phases.slice(0, 5)
}

function splitTryTonightSteps(text: string): DialogueTryTonightStep[] {
  const trimmed = text.trim()
  if (!trimmed) {
    return [
      {
        label: '第 1 步 · 今晚可试',
        text: '先换一句更轻的开口，说完就离开，不追加解释或检查。',
      },
    ]
  }
  const numbered = trimmed.split(/\n(?=第\s*[12]\s*步)/).map((part) => part.trim()).filter(Boolean)
  if (numbered.length >= 2) {
    return numbered.slice(0, 2).map((part, i) => {
      const lines = part.split('\n')
      const label = lines[0]?.replace(/[：:]\s*$/, '') || `第 ${i + 1} 步`
      return { label, text: lines.slice(1).join('\n').trim() || part }
    })
  }
  const parts = trimmed.split(/[；;]/).map((p) => p.trim()).filter((p) => p.length > 8)
  if (parts.length >= 2) {
    return [
      { label: '第 1 步 · 启动前', text: parts[0] },
      { label: '第 2 步 · 十分钟后', text: parts.slice(1).join('；') },
    ]
  }
  return [{ label: '第 1 步 · 今晚可试', text: trimmed }]
}

function parseSampleDialogueLines(text: string): DialogueSampleLine[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  return trimmed
    .split(/\n+/)
    .map((line) => {
      const m = line.match(/^(家长|孩子)[：:]\s*(.+)$/)
      if (m) return { role: clampSpeaker(m[1]), text: m[2].trim() }
      return { role: '家长' as const, text: line.trim() }
    })
    .filter((l) => l.text.length > 0)
    .slice(0, 8)
}

export function readStoredDialogueV2(
  rehearsalSeed?: Record<string, unknown>
): DialogueAnalysisV2 | undefined {
  const v2 = rehearsalSeed?.v2
  if (!v2 || typeof v2 !== 'object') return undefined
  const candidate = v2 as DialogueAnalysisV2
  if (Array.isArray(candidate.phases) && candidate.phases.length >= 1 && candidate.synthesis) {
    return candidate
  }
  return undefined
}

export function buildDialogueAnalysisViewModel(row: DialogueAnalysisRecordLike): DialogueAnalysisV2 {
  const stored = readStoredDialogueV2(row.rehearsalSeed)
  if (stored && stored.phases.length >= 2) return stored
  return normalizeDialogueAnalysisV2(
    {
      synthesis: row.analysis,
      summary: row.summary,
      segments: row.segments,
      tryTonight: row.tryTonight,
      sampleDialogue: row.sampleDialogue,
      phases: legacyPhasesFromSegments(row.segments),
    },
    row.summary
  )
}

export function flattenPhaseSegments(v2: DialogueAnalysisV2): DialogueAnalysisSegment[] {
  return v2.phases.flatMap((phase: DialoguePhase) =>
    phase.quotes.map((q: DialoguePhaseQuote) => ({
      speaker: q.speaker,
      text: q.text,
      highlight: Boolean(q.isPeak),
    }))
  )
}

export function serializeTryTonight(steps: DialogueTryTonightStep[]): string {
  return steps.map((s) => `${s.label}：${s.text}`).join('\n')
}

export function serializeSampleDialogue(lines: DialogueSampleLine[]): string {
  return lines
    .map((l) => {
      const prefix = l.stageDirection ? `（${l.stageDirection}）` : ''
      return `${l.role}${prefix}：${l.text}`
    })
    .join('\n')
}

import 'server-only'

import { callFastJson, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { promptRegistry } from '@/lib/server/prompts/registry.generated'
import { validatePolishedOutput } from '@/lib/server/profile/handbook-quality-gate'
import type { HandbookAdmissionSource } from '@/types/handbook-pack'

export type LineEditorInput = {
  source: HandbookAdmissionSource
  rawEvidence: string
  titleHint?: string
  occurredAt: string
  contextSummary?: string
}

export type LineEditorOutput = {
  displayLine: string
  teaser?: string
  whyIncluded?: string
  accepted: boolean
}

function fallbackLine(raw: string): string {
  const t = raw.trim()
  if (t.length <= 24) return t
  return `${t.slice(0, 22).replace(/[，,。：:；;]$/, '')}…`
}

export async function polishHandbookLine(
  input: LineEditorInput,
  opts?: { retry?: boolean }
): Promise<LineEditorOutput> {
  const raw = await callFastJson<Partial<LineEditorOutput>>(
    [promptRegistry.parentFacingStyle, promptRegistry.handbookLineEditor].join('\n\n---\n\n'),
    input,
    { maxTokens: 512, disableThinking: frontAiThinkingDisabled() }
  ).catch(() => undefined)

  const displayLine = raw?.displayLine?.trim().slice(0, 28) || fallbackLine(input.rawEvidence)
  const out = {
    displayLine,
    teaser: raw?.teaser?.trim().slice(0, 48),
    whyIncluded: raw?.whyIncluded?.trim().slice(0, 88),
  }

  if (validatePolishedOutput(input.rawEvidence, out)) {
    return { ...out, accepted: true }
  }

  if (!opts?.retry) {
    return polishHandbookLine(input, { retry: true })
  }

  return { ...out, accepted: false }
}

export async function polishHandbookLines(
  inputs: LineEditorInput[]
): Promise<LineEditorOutput[]> {
  const out: LineEditorOutput[] = []
  for (const input of inputs) {
    out.push(await polishHandbookLine(input))
  }
  return out
}

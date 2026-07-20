import 'server-only'

import { createHash } from 'node:crypto'
import type { TenantId } from '@/lib/server/memory/tenant'
import { getRollingWindowKey } from '@/lib/server/profile/rolling-window'
import { saveHandbookCandidate } from '@/lib/server/profile/handbook-candidates-store'
import type { HandbookAdmissionSource } from '@/types/handbook-pack'

export type EnrichedHandbookCandidateInput = {
  source: HandbookAdmissionSource
  sourceRef: string
  rawEvidence: string
  contextSummary?: string
  occurredAt?: string
  parentQuote?: string
  childQuote?: string
  sceneHint?: string
  sourceTraceId?: string
}

function composeRawEvidence(input: EnrichedHandbookCandidateInput): string {
  const parent = input.parentQuote?.trim() || ''
  const child = input.childQuote?.trim() || ''
  const scene = input.sceneHint?.trim() || ''
  const parts: string[] = []
  if (scene) parts.push(`场景：${scene}`)
  if (parent) parts.push(`家长：${parent}`)
  if (child) parts.push(`孩子：${child}`)
  if (parts.length) return parts.join('\n')
  return input.rawEvidence.trim()
}

/** episode_ingest / memory_write 完成后写入 enriched 候选，供 admission 优先读取 */
export async function saveEnrichedHandbookCandidate(
  tenant: TenantId,
  input: EnrichedHandbookCandidateInput
): Promise<void> {
  const composed = composeRawEvidence(input)
  if (!composed || composed.length < 12) return
  const candidateId =
    input.sourceRef ||
    createHash('sha256').update(`${input.source}:${composed}`).digest('hex').slice(0, 16)
  await saveHandbookCandidate(tenant, {
    candidateId,
    source: input.source,
    sourceRef: input.sourceRef,
    rawEvidence: composed.slice(0, 600),
    contextSummary: input.contextSummary?.slice(0, 200),
    parentQuote: input.parentQuote?.slice(0, 400),
    childQuote: input.childQuote?.slice(0, 200),
    sceneHint: input.sceneHint?.slice(0, 80),
    sourceTraceId: input.sourceTraceId,
    occurredAt: input.occurredAt || new Date().toISOString(),
    weekKey: getRollingWindowKey(new Date(input.occurredAt || Date.now())),
  })
}

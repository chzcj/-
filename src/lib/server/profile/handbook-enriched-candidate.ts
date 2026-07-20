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
}

/** episode_ingest / memory_write 完成后写入 enriched 候选，供 admission 优先读取 */
export async function saveEnrichedHandbookCandidate(
  tenant: TenantId,
  input: EnrichedHandbookCandidateInput
): Promise<void> {
  const raw = input.rawEvidence?.trim()
  if (!raw || raw.length < 12) return
  const candidateId =
    input.sourceRef ||
    createHash('sha256').update(`${input.source}:${raw}`).digest('hex').slice(0, 16)
  await saveHandbookCandidate(tenant, {
    candidateId,
    source: input.source,
    sourceRef: input.sourceRef,
    rawEvidence: raw.slice(0, 600),
    contextSummary: input.contextSummary?.slice(0, 200),
    occurredAt: input.occurredAt || new Date().toISOString(),
    weekKey: getRollingWindowKey(new Date(input.occurredAt || Date.now())),
  })
}

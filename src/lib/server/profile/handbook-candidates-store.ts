import 'server-only'

import { upsertMemoryLayerItems, loadMemoryLayerItemsByIdPrefix } from '@/lib/server/db'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { HandbookAdmissionSource } from '@/types/handbook-pack'

const CANDIDATES_LAYER = 'handbook_admit_candidates'

export type HandbookCandidate = {
  candidateId: string
  source: HandbookAdmissionSource
  sourceRef: string
  rawEvidence: string
  occurredAt: string
  weekKey: string
  contextSummary?: string
}

function candidateItemId(candidateId: string) {
  return `cand:${candidateId}`
}

export async function saveHandbookCandidate(
  tenant: TenantId,
  candidate: HandbookCandidate
): Promise<void> {
  await upsertMemoryLayerItems(
    CANDIDATES_LAYER,
    [
      {
        itemId: candidateItemId(candidate.candidateId),
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: candidate,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}

export async function loadHandbookCandidatesForWeek(
  tenant: TenantId,
  weekKey: string
): Promise<HandbookCandidate[]> {
  const all = await loadAllHandbookCandidates(tenant)
  return all.filter((c) => c.weekKey === weekKey)
}

export async function loadAllHandbookCandidates(tenant: TenantId): Promise<HandbookCandidate[]> {
  const rows =
    (await loadMemoryLayerItemsByIdPrefix<HandbookCandidate>(
      CANDIDATES_LAYER,
      'cand:',
      tenant.familyId,
      tenant.childId
    ).catch(() => [])) ?? []
  return rows.filter((c) => c.source && c.sourceRef)
}

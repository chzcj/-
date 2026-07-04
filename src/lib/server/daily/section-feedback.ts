import 'server-only'

import { getTurnEventByTraceId, saveTurnEvent } from '@/lib/server/memory/database-manager'
import { enqueueJob, modelReviewBucketKey } from '@/lib/server/jobs/queue'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { TurnEvent } from '@/types/database'
import {
  applyAccurateSectionFeedbackMemory,
  applyPartialSectionFeedbackMemory,
} from '@/lib/server/daily/feedback-memory'

export type SectionFeedbackKind = 'accurate' | 'partial'

export async function recordDailySectionFeedback(args: {
  tenant: TenantId
  traceId: string
  kind: SectionFeedbackKind
  sectionIds?: string[]
  note?: string
}): Promise<{ saved: boolean; reason?: string }> {
  const existing = await getTurnEventByTraceId(args.tenant, args.traceId)
  if (!existing) {
    return { saved: false, reason: 'TURN_NOT_FOUND' }
  }

  const pack =
    existing.specializedContextPackSnapshot && typeof existing.specializedContextPackSnapshot === 'object'
      ? { ...(existing.specializedContextPackSnapshot as Record<string, unknown>) }
      : {}

  pack.sectionFeedback = {
    kind: args.kind,
    sectionIds: args.sectionIds || [],
    note: args.note?.trim() || undefined,
    at: new Date().toISOString(),
  }

  const updated: TurnEvent = {
    ...existing,
    specializedContextPackSnapshot: pack,
  }

  await saveTurnEvent(args.tenant, updated)

  if (args.kind === 'accurate') {
    await applyAccurateSectionFeedbackMemory(args.tenant, updated)
  }

  if (args.kind === 'partial') {
    if (args.note?.trim()) {
      await applyPartialSectionFeedbackMemory(args.tenant, updated, args.note)
    }
    void enqueueJob(
      'model_review',
      {
        tenant: args.tenant,
        reason: 'section_feedback_partial',
        traceId: args.traceId,
        sectionIds: args.sectionIds || [],
      },
      modelReviewBucketKey(args.tenant),
      args.traceId
    )
  }

  return { saved: true }
}

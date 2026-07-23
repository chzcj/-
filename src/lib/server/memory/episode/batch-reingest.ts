import 'server-only'

import { listTurnEvents } from '@/lib/server/memory/database-manager'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'
import { shouldSkipEpisodeIngest } from '@/lib/server/memory/episode/ingest-gate'
import { enqueueJob } from '@/lib/server/jobs/queue'
import type { TenantId } from '@/lib/server/memory/tenant'

export async function runEpisodeBatchReingest(
  tenant: TenantId,
  opts: { limit?: number; dryRun?: boolean } = {}
): Promise<{ scanned: number; skippedGreeting: number; enqueued: number }> {
  const limit = opts.limit ?? 500
  const turns = await listTurnEvents(tenant, limit)
  let skippedGreeting = 0
  let enqueued = 0

  for (const turn of turns) {
    const text = turn.userMessage?.trim() || ''
    if (!text || shouldSkipEpisodeIngest(text)) {
      skippedGreeting++
      continue
    }
    const episodeCtx = {
      familyId: tenant.familyId,
      childId: tenant.childId,
      sourceEventId: turn.traceId,
    }
    const episodeId = deriveEpisodeId(text, episodeCtx)
    if (!opts.dryRun) {
      await enqueueJob(
        'episode_ingest',
        { text, ctx: { ...episodeCtx, episodeId } },
        `episode_reingest:${episodeId}`,
        turn.traceId
      )
    }
    enqueued++
  }

  return { scanned: turns.length, skippedGreeting, enqueued }
}

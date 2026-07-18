import 'server-only'

import { createHash } from 'node:crypto'
import type { DeepModelDigest } from '@/types/deep-model-digest'
import type { BuiltProfileSnapshot, ProfileBuildRun } from '@/lib/server/memory/database-manager'
import type { DailyUiSnapshot } from '@/lib/server/profile/daily-refresh-agent'

export type ProfilePresentationWatermark = {
  /** 前台缓存键：built / UI / digest / build-run 任一变化即变 */
  compositeVersion: string
  builtUpdatedAt: string | null
  uiRefreshedAt: string | null
  digestUpdatedAt: string | null
  buildInputVersion: string | null
  buildRunStatus: ProfileBuildRun['status'] | null
  uiStale: boolean
  digestStale: boolean
  partiallyRefreshing: boolean
}

const STALE_TOLERANCE_MS = 60_000

function parseTime(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

export function buildProfilePresentationWatermark(input: {
  built?: BuiltProfileSnapshot | null
  uiSnapshot?: DailyUiSnapshot | null
  digest?: DeepModelDigest | null
  buildRun?: ProfileBuildRun | null
}): ProfilePresentationWatermark {
  const builtUpdatedAt = input.built?.updatedAt || null
  const uiRefreshedAt = input.uiSnapshot?.refreshedAt || null
  const digestUpdatedAt = input.digest?.updatedAt || null
  const buildInputVersion = input.buildRun?.inputVersion || null
  const buildRunStatus = input.buildRun?.status || null

  const builtTs = parseTime(builtUpdatedAt)
  const uiTs = parseTime(uiRefreshedAt)
  const digestTs = parseTime(digestUpdatedAt)

  const uiStale = builtTs > 0 && (uiTs === 0 || uiTs + STALE_TOLERANCE_MS < builtTs)
  const digestStale = builtTs > 0 && (digestTs === 0 || digestTs + STALE_TOLERANCE_MS < builtTs)
  const buildInFlight = buildRunStatus === 'pending' || buildRunStatus === 'running'
  const partiallyRefreshing = uiStale || digestStale || buildInFlight

  const compositeVersion = createHash('sha256')
    .update(
      [
        builtUpdatedAt || '',
        uiRefreshedAt || '',
        digestUpdatedAt || '',
        buildInputVersion || '',
        buildRunStatus || '',
        String(input.buildRun?.phase ?? ''),
      ].join('|')
    )
    .digest('hex')
    .slice(0, 16)

  return {
    compositeVersion,
    builtUpdatedAt,
    uiRefreshedAt,
    digestUpdatedAt,
    buildInputVersion,
    buildRunStatus,
    uiStale,
    digestStale,
    partiallyRefreshing,
  }
}

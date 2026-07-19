import 'server-only'

import { createHash } from 'node:crypto'
import {
  getDailyInteractionUpdates,
  getRecentFailedTasks,
  listTurnEvents,
} from '@/lib/server/memory/database-manager'
import type { TenantId } from '@/lib/server/memory/tenant'
import { getLatestDossier } from '@/lib/server/memory/deep-modeling/digest-store'
import {
  getFailedPredictions,
  markPredictionsFailedForCounterEvidence,
} from '@/lib/server/memory/dossier/prediction-failure'
import type { FamilyUnderstandingDossier } from '@/types/family-understanding-dossier'
import type { TurnEvent } from '@/types/database'

export type ReconceptualizeReason =
  | 'counter_evidence'
  | 'intervention_failed'
  | 'prediction_failed'
  | 'fingerprint_shift'
  | 'turn_milestone'
  | 'build_complete'
  | 'forced'

export type ReconceptualizeResult = {
  should: boolean
  reasons: ReconceptualizeReason[]
  failedPredictionId?: string
  failedTaskId?: string
  repeatedTheme?: string
}

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function clusterTurnEventsByTheme(turns: TurnEvent[], dossier: FamilyUnderstandingDossier | null) {
  const clusters = new Map<string, number>()
  for (const t of turns) {
    const mech = t.retrievedContextSnapshot?.matchedMechanisms?.[0]
    const protectiveId = dossier?.fivePs.protective?.[0]?.id
    const theme = (mech || protectiveId || 'general').slice(0, 48)
    clusters.set(theme, (clusters.get(theme) || 0) + 1)
  }
  return [...clusters.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
}

async function checkPredictionFailure(tenant: TenantId): Promise<ReconceptualizeResult | null> {
  const dossier = await getLatestDossier(tenant).catch(() => null)
  const failed = getFailedPredictions(dossier)
  if (!failed.length) return null
  return {
    should: true,
    reasons: ['prediction_failed'],
    failedPredictionId: failed[0].id,
  }
}

async function checkInterventionFailed(tenant: TenantId): Promise<ReconceptualizeResult | null> {
  const failedTasks = await getRecentFailedTasks(tenant, 14)
  if (!failedTasks.length) return null

  const turns = (await listTurnEvents(tenant, 30)).slice(-30)
  const dossier = await getLatestDossier(tenant).catch(() => null)
  const clusters = clusterTurnEventsByTheme(turns, dossier)
  const repeated = clusters.find((c) => c.count >= 3)
  if (!repeated) return null

  return {
    should: true,
    reasons: ['intervention_failed'],
    failedTaskId: failedTasks[0].taskId,
    repeatedTheme: repeated.theme,
  }
}

/** Level 2 重概念化判定（并入 deep_mechanism_review 入口） */
export async function shouldReconceptualize(
  tenant: TenantId,
  opts?: { sourceFingerprint?: string; forceFull?: boolean; reason?: string }
): Promise<ReconceptualizeResult> {
  if (opts?.forceFull) {
    return { should: true, reasons: ['forced'] }
  }

  if (opts?.reason === 'turn_milestone' || opts?.reason === 'build_complete') {
    return {
      should: true,
      reasons: [opts.reason === 'turn_milestone' ? 'turn_milestone' : 'build_complete'],
    }
  }

  const predictionHit = await checkPredictionFailure(tenant)
  if (predictionHit) return predictionHit

  const reasons: ReconceptualizeReason[] = []

  try {
    const updates = await getDailyInteractionUpdates(tenant).catch(() => [])
    const counterRows = updates.filter((u) => u.classification === 'counter_evidence')
    if (counterRows.length >= 2) {
      reasons.push('counter_evidence')
      await markPredictionsFailedForCounterEvidence(tenant).catch((err) =>
        console.warn('[shouldReconceptualize] markPredictionsFailedForCounterEvidence:', err)
      )
    }
  } catch {
    /* no-op */
  }

  const interventionHit = await checkInterventionFailed(tenant)
  if (interventionHit) {
    return {
      should: true,
      reasons: [...new Set([...reasons, ...interventionHit.reasons])],
      failedTaskId: interventionHit.failedTaskId,
      repeatedTheme: interventionHit.repeatedTheme,
    }
  }

  const dossier = await getLatestDossier(tenant).catch(() => null)
  if (opts?.sourceFingerprint && dossier?.evidenceLedger?.length) {
    const prev = sha(JSON.stringify(dossier.evidenceLedger.slice(-20)))
    const next = sha(opts.sourceFingerprint)
    if (prev !== next) reasons.push('fingerprint_shift')
  }

  if (reasons.length) return { should: true, reasons }

  return { should: false, reasons: [] }
}

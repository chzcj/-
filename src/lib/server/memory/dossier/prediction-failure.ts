import 'server-only'

import { getLatestDossier, saveDossierVersion, loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import type { DossierPrediction } from '@/types/family-understanding-dossier'
import type { TenantId } from '@/lib/server/memory/tenant'

function normalizePredictions(predictions: DossierPrediction[] | undefined): DossierPrediction[] {
  return (predictions || []).map((p) => ({
    ...p,
    status: p.status || 'unverified',
  }))
}

/** 标记单条 prediction failed，版本 +1，保留历史 dossier_v{n} */
export async function markDossierPredictionFailed(
  tenant: TenantId,
  predictionId: string,
  changeNote: string
): Promise<boolean> {
  const dossier = await getLatestDossier(tenant)
  if (!dossier?.workingHypothesis?.predictions?.length) return false

  const preds = normalizePredictions(dossier.workingHypothesis.predictions)
  if (!preds.some((p) => p.id === predictionId)) return false

  const nextPreds = preds.map((p) =>
    p.id === predictionId ? { ...p, status: 'failed' as const } : p
  )
  const version = (dossier.version || 0) + 1
  const digest = await loadDeepModelDigest(tenant)

  await saveDossierVersion(
    {
      ...dossier,
      version,
      workingHypothesis: { ...dossier.workingHypothesis, predictions: nextPreds },
      changeLog: [...(dossier.changeLog || []), changeNote],
      updatedAt: new Date().toISOString(),
    },
    tenant,
    digest
  )
  return true
}

/** 反证≥2 时：将与 interventionTargets 关联的 prediction 标 failed */
export async function markPredictionsFailedForCounterEvidence(tenant: TenantId): Promise<string[]> {
  const dossier = await getLatestDossier(tenant)
  if (!dossier?.interventionTargets?.length) return []

  const linkedPredIds = [
    ...new Set(
      dossier.interventionTargets.map((t) => t.prediction).filter((id): id is string => Boolean(id))
    ),
  ]
  if (!linkedPredIds.length) return []

  const preds = normalizePredictions(dossier.workingHypothesis?.predictions)
  const toFail = linkedPredIds.filter((id) => preds.some((p) => p.id === id && p.status !== 'failed'))
  if (!toFail.length) return []

  const nextPreds = preds.map((p) =>
    toFail.includes(p.id) ? { ...p, status: 'failed' as const } : p
  )
  const version = (dossier.version || 0) + 1
  const digest = await loadDeepModelDigest(tenant)

  await saveDossierVersion(
    {
      ...dossier,
      version,
      workingHypothesis: { ...dossier.workingHypothesis, predictions: nextPreds },
      changeLog: [
        ...(dossier.changeLog || []),
        `v${version}: 反证≥2，prediction ${toFail.join(',')} 标记 failed`,
      ],
      updatedAt: new Date().toISOString(),
    },
    tenant,
    digest
  )
  return toFail
}

export function getFailedPredictions(
  dossier: Awaited<ReturnType<typeof getLatestDossier>>
): Array<{ id: string; text: string }> {
  if (!dossier?.workingHypothesis?.predictions?.length) return []
  return normalizePredictions(dossier.workingHypothesis.predictions)
    .filter((p) => p.status === 'failed')
    .map((p) => ({ id: p.id, text: p.text }))
}

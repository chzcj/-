import 'server-only'

import { callAgentJson } from '@/lib/server/ark-agents'
import { loadDeepModelDigest, saveDossierVersion, getLatestDossier } from '@/lib/server/memory/deep-modeling/digest-store'
import type { FamilyUnderstandingDossier } from '@/types/family-understanding-dossier'
import type { TenantId } from '@/lib/server/memory/tenant'
import { isPortraitV3Enabled } from '@/lib/server/memory/dossier/portrait-v3-flags'

export type DossierPatchPayload = {
  tenant: TenantId
  newFacts?: string[]
  traceId?: string | null
}

type DossierPatchOutput = {
  dossier?: FamilyUnderstandingDossier
  patchApplied?: boolean
}

/** Level 1 增量 patch：读 latest dossier + 新事实 → 保存 dossier_v{n} */
export async function runDossierPatch(payload: DossierPatchPayload): Promise<boolean> {
  if (!isPortraitV3Enabled()) return false

  const { tenant, newFacts = [] } = payload
  const existing = await getLatestDossier(tenant)
  if (!existing?.workingHypothesis?.text) return false

  const facts = newFacts.filter(Boolean).slice(0, 8)
  if (!facts.length) return false

  let patchRaw: DossierPatchOutput | undefined
  try {
    patchRaw = await callAgentJson<DossierPatchOutput>(
      'dossierPatcher',
      '基于新事实对理解底稿做 Level 1 增量更新：不改 workingHypothesis 核心，更新受影响段落并追加 changeLog。',
      { previousDossier: existing, newFacts: facts },
      { maxTokens: 8192, timeoutMs: 90_000 }
    )
  } catch (err) {
    console.warn('[dossier-patch] LLM 失败:', err)
    return false
  }

  const next = patchRaw?.dossier
  if (!next?.workingHypothesis?.text) return false

  const version = (existing.version || 1) + 1
  const digest = await loadDeepModelDigest(tenant)
  await saveDossierVersion(
    {
      ...next,
      version,
      changeLog: [...(existing.changeLog || []), ...(next.changeLog || [])].slice(-12),
      updatedAt: new Date().toISOString(),
    },
    tenant,
    digest
  )
  return true
}

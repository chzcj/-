import { createHash } from 'node:crypto'
import { computeProfileInputVersion, type ProfileBuildEntryModule } from '@/lib/profile/build-input'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { EntryEvidencePack, SynthesisOutput } from '@/types/database'

function fingerprint(parts: unknown[]): string {
  const raw = JSON.stringify(parts)
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

export function legacySynthesisMemoryWriteKey(
  tenant: TenantId,
  input: {
    entryMap?: Record<string, ProfileBuildEntryModule>
    crossCuttingSupplement?: string
    maturityLevel?: string
    entryPacks?: EntryEvidencePack[]
  }
): string {
  const { familyId, childId } = tenant
  if (input.entryMap && Object.keys(input.entryMap).length > 0) {
    const inputVersion = computeProfileInputVersion({
      entryMap: input.entryMap,
      finalFollowUpText: input.crossCuttingSupplement || '',
    })
    return `legacy_synthesis:${familyId}:${childId}:${inputVersion}`
  }
  const packSig = (input.entryPacks || []).map((p) => [p.packId, p.entryName, p.rawInputSummary])
  const sig = fingerprint([
    packSig,
    input.crossCuttingSupplement || '',
    input.maturityLevel || '',
  ])
  return `legacy_synthesis:${familyId}:${childId}:${sig}`
}

export function legacyDiagnosisMemoryWriteKey(
  tenant: TenantId,
  input: {
    taskType?: string
    surfaceProblem?: string
    parentSurfaceJudgment?: string
    maturityLevel?: string
    facts?: string[]
    childQuotes?: string[]
    parentQuotes?: string[]
    synthesisOutput?: SynthesisOutput
  }
): string {
  const { familyId, childId } = tenant
  if (input.synthesisOutput) {
    const syn = input.synthesisOutput
    const sig = fingerprint([
      input.taskType || 'initial_model',
      syn.contextMaturityLevel || input.maturityLevel || '',
      (syn.candidateMechanismMatrix || []).map((m) => m.mechanismName),
      syn.crossEntryEvidenceMap?.length || 0,
    ])
    return `legacy_diagnosis:${familyId}:${childId}:${sig}`
  }
  const sig = fingerprint([
    input.taskType || 'initial_model',
    input.surfaceProblem || '',
    input.parentSurfaceJudgment || '',
    input.maturityLevel || '',
    input.facts || [],
    input.childQuotes || [],
    input.parentQuotes || [],
  ])
  return `legacy_diagnosis:${familyId}:${childId}:${sig}`
}

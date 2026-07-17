import 'server-only'

import { createId } from '@/lib/storage/storageIds'
import {
  computeProfileInputVersion,
  resolveMaturityLevel,
  type ProfileBuildEntryModule,
} from '@/lib/profile/build-input'
import { buildSnapshotFromResults } from '@/lib/profile/build-snapshot'
import {
  computeBuildCompleteness,
  isBuildCompletenessV2Enabled,
  type ModuleCompletenessInput,
} from '@/lib/build/completeness'
import { humanizeBuiltJudgment } from '@/lib/server/daily/profile-sanitize'
import { buildEntryPack } from '@/lib/server/memory/entry-builder'
import { buildMemoryWritePlan } from '@/lib/server/memory/pipeline'
import {
  clearProfileBuildStageCache,
  getBuildProgress,
  getLatestBuiltProfileSnapshot,
  getLatestProfileBuildRun,
  getProfileBuildInputSnapshot,
  getProfileBuildStageCache,
  purgeProfileBuildInputSnapshot,
  saveBuiltProfileSnapshot,
  saveProfileBuildInputSnapshot,
  saveProfileBuildRun,
  saveProfileBuildStageCache,
  type BuiltProfileSnapshot,
  type ProfileBuildInputSnapshot,
  type ProfileBuildRun,
  type ProfileBuildRunStage,
} from '@/lib/server/memory/database-manager'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { buildDiagnosisRetrievalPacket, buildSynthesisRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { runDiagnosisPipeline } from '@/lib/server/diagnosis/pipeline'
import { runSynthesisPipeline } from '@/lib/server/synthesis/pipeline'
import { enqueueJob } from '@/lib/server/jobs/queue'
import type { TenantId } from '@/lib/server/memory/tenant'
import type { EntryEvidencePack, SynthesisOutput } from '@/types/database'

const BUILD_MODULE_KEYS = ['daily', 'homework', 'communication', 'family'] as const

const STAGE_LABELS: Record<ProfileBuildRunStage, { phase: number; label: string }> = {
  synthesis: { phase: 1, label: '跨模块综合建模…' },
  diagnosis: { phase: 2, label: '深度诊断与机制复核…' },
  persist: { phase: 3, label: '保存孩子画像…' },
  readiness: { phase: 4, label: '整理首版画像…' },
}

export type ProfileBuildRunPublic = Pick<
  ProfileBuildRun,
  'runId' | 'inputVersion' | 'status' | 'phase' | 'label' | 'currentStage' | 'failedStage' | 'error' | 'startedAt' | 'updatedAt' | 'completedAt'
>

export function toPublicBuildRun(run: ProfileBuildRun): ProfileBuildRunPublic {
  return {
    runId: run.runId,
    inputVersion: run.inputVersion,
    status: run.status,
    phase: run.phase,
    label: run.label,
    currentStage: run.currentStage,
    failedStage: run.failedStage,
    error: run.error,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
  }
}

function normalizeEntryMap(
  entryMap: Record<string, ProfileBuildEntryModule>
): Record<string, ProfileBuildEntryModule> {
  const normalized: Record<string, ProfileBuildEntryModule> = {}
  for (const key of BUILD_MODULE_KEYS) {
    const mod = entryMap[key]
    normalized[key] = {
      rawTexts: mod?.rawTexts || [],
      followUps: mod?.followUps || [],
      stageSummary: mod?.stageSummary,
      aiFacts: mod?.aiFacts,
      aiHypotheses: mod?.aiHypotheses,
      moduleComplete: mod?.moduleComplete,
      summarySufficient: mod?.summarySufficient,
    }
  }
  return normalized
}

export function buildInputSnapshotFromBody(body: {
  entryMap?: Record<string, ProfileBuildEntryModule>
  finalFollowUpText?: string
}): ProfileBuildInputSnapshot {
  const entryMap = normalizeEntryMap(body.entryMap || {})
  const finalFollowUpText = typeof body.finalFollowUpText === 'string' ? body.finalFollowUpText.trim() : ''
  const inputVersion = computeProfileInputVersion({ entryMap, finalFollowUpText })
  return {
    inputVersion,
    finalFollowUpText,
    entryMap,
    createdAt: new Date().toISOString(),
  }
}

async function clampCompleteness(tenant: TenantId, clientValue: number) {
  if (!isBuildCompletenessV2Enabled()) return Math.min(100, Math.max(0, clientValue))
  const progress = await getBuildProgress(tenant).catch(() => null)
  if (!progress) return Math.min(clientValue, 99)
  const completed = new Set(progress.completedEntries || [])
  const byType = new Map((progress.stageSummaries || []).map((s) => [s.entryType, s] as const))
  const modules: ModuleCompletenessInput[] = BUILD_MODULE_KEYS.map((key) => {
    const summary = byType.get(key)
    return {
      confirmed: completed.has(key),
      mainJudgment: summary?.mainJudgment || '',
      facts: summary?.facts || [],
      sufficient: summary?.sufficient,
    }
  })
  return computeBuildCompleteness(modules).completeness
}

async function patchRun(tenant: TenantId, patch: Partial<ProfileBuildRun> & { runId: string }) {
  const current = await getLatestProfileBuildRun(tenant)
  if (!current || current.runId !== patch.runId) return current
  const next: ProfileBuildRun = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  await saveProfileBuildRun(next, tenant)
  return next
}

function buildEntryPacks(
  entryMap: Record<string, ProfileBuildEntryModule>,
  tenant: TenantId
): EntryEvidencePack[] {
  return Object.entries(entryMap)
    .filter(([, data]) => data.rawTexts.length > 0 || (data.aiFacts?.length || 0) > 0)
    .map(([key, data], idx) => buildEntryPack(key, data, tenant.familyId, tenant.childId, idx))
}

async function enqueueSynthesisMemoryWrite(
  tenant: TenantId,
  output: SynthesisOutput,
  inputVersion: string
) {
  const { familyId, childId } = tenant
  const writePlan = buildMemoryWritePlan({
    tenant,
    crossEntryNetwork: { networkData: output },
    pendingHypotheses: output.memoryWriteSuggestions.pendingHypotheses.map((h, i) => ({
      hypothesisId: `hyp-${Date.now()}-${i}`,
      familyId,
      childId,
      hypothesis: h,
      triggerSource: 'synthesis',
      supportingEvidence: [],
      missingEvidence: output.diagnosisHandoffPackage.stillNeedToVerify,
      verificationQuestions: [],
      possibleCounterEvidence: [],
      weight: 'medium' as const,
      applicableScenes: [],
      status: 'pending' as const,
      retrievalTags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    rationale: {
      whyUpdate: '多入口综合建模完成',
      whyNotPromoteSomeItems:
        output.diagnosisHandoffPackage.recommendedDiagnosisStrength === 'stage'
          ? '部分入口未完成'
          : '',
      riskOfOvergeneralization: '',
      nextVerificationNeed: output.diagnosisHandoffPackage.stillNeedToVerify.join('；'),
    },
  })
  await enqueueJob(
    'memory_write',
    { plan: writePlan, tenant },
    `profile_build:synthesis:${tenant.familyId}:${tenant.childId}:${inputVersion}`,
    createId('trace')
  )
}

async function enqueueDiagnosisMemoryWrite(
  tenant: TenantId,
  output: Awaited<ReturnType<typeof runDiagnosisPipeline>>,
  inputVersion: string
) {
  const { familyId, childId } = tenant
  const writePlan = buildMemoryWritePlan({
    tenant,
    diagnosisOutput: output,
    conditionalProfiles: output.secondMeConditionalProfile.map((cp, i) => ({
      profileId: `prof-${Date.now()}-${i}`,
      familyId,
      childId,
      status: 'stage_judgment' as const,
      triggerScene: '',
      childTendency: cp,
      notBecause: '',
      likelyBecause: '',
      parentInterventionEffect: '',
      protectiveStrategy: '',
      evidenceSources: [],
      strength: 'medium' as const,
      boundaries: output.needsFurtherVerification,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    pendingHypotheses: output.handoffToMemoryAgent.pendingHypotheses.map((h, i) => ({
      hypothesisId: `hyp-${Date.now()}-${i}`,
      familyId,
      childId,
      hypothesis: h,
      triggerSource: 'diagnosis',
      supportingEvidence: output.crossSceneEvidencePaths,
      missingEvidence: output.needsFurtherVerification,
      verificationQuestions: [],
      possibleCounterEvidence: [],
      weight: 'medium_high' as const,
      applicableScenes: [],
      status: 'pending' as const,
      retrievalTags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    rationale: {
      whyUpdate: '深层诊断完成',
      whyNotPromoteSomeItems: '',
      riskOfOvergeneralization: '',
      nextVerificationNeed: output.needsFurtherVerification.join('；'),
    },
  })
  await enqueueJob(
    'memory_write',
    { plan: writePlan, tenant },
    `profile_build:diagnosis:${tenant.familyId}:${tenant.childId}:${inputVersion}`,
    createId('trace')
  )
}

async function waitForProfileReadiness(tenant: TenantId): Promise<void> {
  const { getLatestChildStructureModel } = await import('@/lib/server/memory/database-manager')
  const { getCurrentVersions } = await import('@/lib/server/db')
  const MAX_TRIES = 6
  const INTERVAL = 2500
  for (let i = 0; i < MAX_TRIES; i++) {
    const [model, versions] = await Promise.all([
      getLatestChildStructureModel(tenant).catch(() => null),
      getCurrentVersions(tenant.familyId, tenant.childId).catch(() => ({ briefVersion: 0, boardVersion: 0 })),
    ])
    const ready = Boolean(model) && versions.briefVersion > 0 && versions.boardVersion > 0
    if (ready) return
    await new Promise((r) => setTimeout(r, INTERVAL))
  }
}

export async function startProfileBuildRun(
  tenant: TenantId,
  snapshot: ProfileBuildInputSnapshot
): Promise<ProfileBuildRun> {
  await saveProfileBuildInputSnapshot(snapshot, tenant)
  const existing = await getLatestProfileBuildRun(tenant)
  if (
    existing &&
    existing.inputVersion === snapshot.inputVersion &&
    (existing.status === 'running' || existing.status === 'pending' || existing.status === 'succeeded')
  ) {
    return existing
  }

  const now = new Date().toISOString()
  const run: ProfileBuildRun = {
    runId: createId('pbr'),
    inputVersion: snapshot.inputVersion,
    status: 'pending',
    phase: 0,
    label: '正在整理四个模块的关键事实…',
    startedAt: now,
    updatedAt: now,
  }
  await saveProfileBuildRun(run, tenant)
  await clearProfileBuildStageCache(tenant)
  await enqueueJob(
    'profile_build_run',
    { tenant, runId: run.runId, inputVersion: snapshot.inputVersion },
    `profile_build_run:${tenant.familyId}:${tenant.childId}:${snapshot.inputVersion}`,
    run.runId
  )
  return run
}

export async function retryProfileBuildRun(
  tenant: TenantId,
  fromStage?: ProfileBuildRunStage
): Promise<ProfileBuildRun | null> {
  const run = await getLatestProfileBuildRun(tenant)
  if (!run || run.status !== 'failed') return run
  const stage = fromStage || run.failedStage || 'synthesis'
  const next: ProfileBuildRun = {
    ...run,
    status: 'pending',
    error: undefined,
    failedStage: undefined,
    currentStage: stage,
    label: STAGE_LABELS[stage]?.label || '正在重试…',
    updatedAt: new Date().toISOString(),
  }
  await saveProfileBuildRun(next, tenant)
  await enqueueJob(
    'profile_build_run',
    { tenant, runId: run.runId, inputVersion: run.inputVersion, fromStage: stage },
    `profile_build_run:${tenant.familyId}:${tenant.childId}:${run.inputVersion}:retry:${stage}`,
    run.runId
  )
  return next
}

export async function executeProfileBuildRun(
  tenant: TenantId,
  runId: string,
  options?: { fromStage?: ProfileBuildRunStage; inputVersion?: string }
): Promise<void> {
  let run = await getLatestProfileBuildRun(tenant)
  if (!run || run.runId !== runId) return
  if (run.status === 'succeeded') return

  const snapshot =
    (await getProfileBuildInputSnapshot(tenant)) ||
    (options?.inputVersion
      ? null
      : null)
  if (!snapshot || snapshot.inputVersion !== run.inputVersion) {
    await patchRun(tenant, {
      runId,
      status: 'failed',
      failedStage: run.currentStage || 'synthesis',
      error: '建档输入快照缺失，请返回最后补充页重新提交。',
    })
    return
  }

  run = (await patchRun(tenant, {
    runId,
    status: 'running',
    phase: 0,
    label: '正在整理四个模块的关键事实…',
    error: undefined,
    failedStage: undefined,
  }))!

  const stageOrder: ProfileBuildRunStage[] = ['synthesis', 'diagnosis', 'persist', 'readiness']
  const startIndex = options?.fromStage
    ? Math.max(0, stageOrder.indexOf(options.fromStage))
    : 0

  let cache = (await getProfileBuildStageCache(tenant)) || {
    inputVersion: snapshot.inputVersion,
    updatedAt: new Date().toISOString(),
  }
  if (cache.inputVersion !== snapshot.inputVersion) {
    cache = { inputVersion: snapshot.inputVersion, updatedAt: new Date().toISOString() }
  }

  try {
    for (let i = startIndex; i < stageOrder.length; i++) {
      const stage = stageOrder[i]!
      const meta = STAGE_LABELS[stage]
      run = (await patchRun(tenant, {
        runId,
        status: 'running',
        currentStage: stage,
        phase: meta.phase,
        label: meta.label,
      }))!

      if (stage === 'synthesis') {
        if (!cache.synthesis) {
          const maturityLevel = resolveMaturityLevel(snapshot.entryMap)
          const retrievalPacket = await buildSynthesisRetrievalPacket(tenant)
          const packs = buildEntryPacks(snapshot.entryMap, tenant)
          const output = await runSynthesisPipeline({
            maturityLevel,
            entryPacks: packs,
            existingNetwork: retrievalPacket.existingEvidenceNetwork,
            crossCuttingSupplement: snapshot.finalFollowUpText || undefined,
          })
          cache = {
            ...cache,
            synthesis: output as unknown as Record<string, unknown>,
            updatedAt: new Date().toISOString(),
          }
          await saveProfileBuildStageCache(cache, tenant)
          await enqueueSynthesisMemoryWrite(tenant, output, snapshot.inputVersion)
        }
      } else if (stage === 'diagnosis') {
        if (!cache.diagnosis) {
          const syn = (cache.synthesis || {}) as unknown as SynthesisOutput
          const maturityLevel = syn.contextMaturityLevel || resolveMaturityLevel(snapshot.entryMap)
          const retrievalPacket = await buildDiagnosisRetrievalPacket(tenant)
          const facts = ((syn.candidateMechanismMatrix as Array<{ supportingEvidence?: string[] }>) || []).flatMap(
            (m) => m.supportingEvidence || []
          )
          const output = await runDiagnosisPipeline({
            taskType: 'profile_build',
            maturityLevel,
            surfaceProblem:
              ((syn.candidateMechanismMatrix as Array<{ mechanismName?: string }>) || [])[0]?.mechanismName ||
              '',
            parentSurfaceJudgment: '',
            synthesisOutput: syn,
            facts: facts.length > 0 ? facts : retrievalPacket.highStrengthEvidence,
            childQuotes: retrievalPacket.childQuotes,
            parentQuotes: retrievalPacket.parentQuotes,
            pendingHypotheses: retrievalPacket.pendingBoundaries,
          })
          cache = {
            ...cache,
            diagnosis: output as unknown as Record<string, unknown>,
            updatedAt: new Date().toISOString(),
          }
          await saveProfileBuildStageCache(cache, tenant)
          await enqueueDiagnosisMemoryWrite(tenant, output, snapshot.inputVersion)
        }
      } else if (stage === 'persist') {
        const syn = cache.synthesis || {}
        const diag = cache.diagnosis || {}
        const rawSnapshot = buildSnapshotFromResults(syn, diag, snapshot.entryMap)
        const completeness = await clampCompleteness(tenant, rawSnapshot.completeness)
        const built: BuiltProfileSnapshot = {
          ...rawSnapshot,
          completeness,
          coreJudgment: humanizeBuiltJudgment(rawSnapshot.coreJudgment, {
            deepMechanism: rawSnapshot.deepMechanism,
            supportFocus: rawSnapshot.supportFocus,
          }),
        }
        await saveBuiltProfileSnapshot(built, tenant)
        const dayBucket = new Date().toISOString().slice(0, 10)
        await enqueueJob(
          'deep_mechanism_review',
          { tenant },
          `deep_mechanism:build:${tenant.familyId}:${tenant.childId}:${dayBucket}`,
          null
        ).catch(() => {})
        void buildDeepModelDigest(tenant)
      } else if (stage === 'readiness') {
        await waitForProfileReadiness(tenant)
      }
    }

    await patchRun(tenant, {
      runId,
      status: 'succeeded',
      phase: 4,
      label: '画像已准备好',
      currentStage: undefined,
      completedAt: new Date().toISOString(),
    })
    await clearProfileBuildStageCache(tenant)
    await purgeProfileBuildInputSnapshot(tenant)
    const latest = await getLatestProfileBuildRun(tenant)
    if (latest?.runId === runId) {
      await saveProfileBuildRun({ ...latest, inputPurged: true }, tenant)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '画像整理未完成'
    const failedStage = run.currentStage || 'synthesis'
    await patchRun(tenant, {
      runId,
      status: 'failed',
      failedStage,
      error: message,
      label: '画像整理未完成',
    })
    throw error
  }
}

export async function getProfileBuildRunView(tenant: TenantId) {
  const [run, built] = await Promise.all([
    getLatestProfileBuildRun(tenant),
    getLatestBuiltProfileSnapshot(tenant).catch(() => null),
  ])
  return {
    run: run ? toPublicBuildRun(run) : null,
    firstVisibleSnapshotReady: Boolean(built?.coreJudgment?.trim()),
  }
}

import 'server-only'

import type { CrossEntryEvidenceNetwork, HypothesisWeight, PendingHypothesis, TurnEvent } from '@/types/database'
import {
  getLatestEvidenceNetwork,
  getPendingHypotheses,
  saveEvidenceNetwork,
  savePendingHypotheses,
} from '@/lib/server/memory/database-manager'
import { buildMemoryWritePlan, createDailyUpdate } from '@/lib/server/memory/pipeline'
import { enqueueJob } from '@/lib/server/jobs/queue'
import type { TenantId } from '@/lib/server/memory/tenant'

const WEIGHT_ORDER: HypothesisWeight[] = ['very_low', 'low', 'medium', 'medium_high', 'high']

function bumpStrength(value: unknown): 'low' | 'medium' | 'high' {
  const s = typeof value === 'string' ? value : 'medium'
  if (s === 'high') return 'high'
  if (s === 'medium') return 'high'
  return 'medium'
}

function bumpHypothesisWeight(weight: HypothesisWeight | undefined): HypothesisWeight {
  const current = weight || 'medium'
  const idx = WEIGHT_ORDER.indexOf(current)
  return WEIGHT_ORDER[Math.min(idx + 1, WEIGHT_ORDER.length - 1)]
}

function mechanismTokens(mechanisms: string[]): string[] {
  return mechanisms
    .flatMap((m) => m.replace(/^还在验证：?/, '').split(/[，,；;、]/))
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
}

function matchesMechanism(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase()
  return tokens.some((t) => lower.includes(t.toLowerCase()) || t.toLowerCase().includes(lower.slice(0, 8)))
}

async function boostEvidenceNetworkMechanisms(tenant: TenantId, mechanisms: string[]): Promise<number> {
  const tokens = mechanismTokens(mechanisms)
  if (!tokens.length) return 0

  const network = await getLatestEvidenceNetwork(tenant)
  if (!network?.candidateMechanismMatrix?.length) return 0

  let bumped = 0
  const matrix = network.candidateMechanismMatrix.map((m) => {
    if (!matchesMechanism(m.mechanismName, tokens) && !matchesMechanism(m.description || '', tokens)) {
      return m
    }
    bumped += 1
    return { ...m, overallStrength: bumpStrength(m.overallStrength) }
  })

  if (bumped === 0) return 0
  await saveEvidenceNetwork({ ...network, candidateMechanismMatrix: matrix }, tenant)
  return bumped
}

async function boostPendingHypotheses(tenant: TenantId, mechanisms: string[]): Promise<number> {
  const tokens = mechanismTokens(mechanisms)
  if (!tokens.length) return 0

  const hyps = await getPendingHypotheses(tenant)
  if (!hyps.length) return 0

  let bumped = 0
  const now = new Date().toISOString()
  const updated: PendingHypothesis[] = hyps.map((h) => {
    if (!matchesMechanism(h.hypothesis, tokens)) return h
    bumped += 1
    return {
      ...h,
      weight: bumpHypothesisWeight(h.weight),
      status: h.status === 'weakened' ? 'pending' : h.status,
      supportingEvidence: Array.from(
        new Set([...(h.supportingEvidence || []), '[家长确认] 深度展开反馈：像我家情况'])
      ),
      updatedAt: now,
    }
  })

  if (bumped === 0) return 0
  await savePendingHypotheses(updated, tenant)
  return bumped
}

/** accurate 反馈：提升本轮关联 mechanism / 假设权重，并写入 supporting daily_update */
export async function applyAccurateSectionFeedbackMemory(
  tenant: TenantId,
  turn: TurnEvent
): Promise<{ networkBumped: number; hypothesisBumped: number }> {
  const mechanisms = turn.retrievedContextSnapshot?.matchedMechanisms || []
  const [networkBumped, hypothesisBumped] = await Promise.all([
    boostEvidenceNetworkMechanisms(tenant, mechanisms),
    boostPendingHypotheses(tenant, mechanisms),
  ])

  const writePlan = buildMemoryWritePlan({
    tenant,
    dailyUpdates: [
      createDailyUpdate(
        `[家长确认准确] ${turn.userMessage.slice(0, 160)}`,
        'old_mechanism_repetition',
        mechanisms,
        tenant,
        turn.traceId
      ),
    ],
    rationale: {
      whyUpdate: '家长确认深度展开像自家情况，提升关联机制权重',
      whyNotPromoteSomeItems: '单轮确认不足以升为稳定画像',
      riskOfOvergeneralization: '需结合后续交流验证',
      nextVerificationNeed: mechanisms[0] || '观察同类场景是否再现',
    },
  })

  void enqueueJob('memory_write', { plan: writePlan, tenant }, `feedback_accurate_${turn.traceId}`, turn.traceId)
  return { networkBumped, hypothesisBumped }
}

/** partial + 补录：记 counter_evidence 并触发 model_review */
export async function applyPartialSectionFeedbackMemory(
  tenant: TenantId,
  turn: TurnEvent,
  note: string
): Promise<void> {
  const trimmed = note.trim()
  if (!trimmed) return

  const writePlan = buildMemoryWritePlan({
    tenant,
    dailyUpdates: [
      createDailyUpdate(
        `[家长校正] ${trimmed}`,
        'counter_evidence',
        turn.retrievedContextSnapshot?.matchedMechanisms || [],
        tenant,
        turn.traceId
      ),
    ],
    rationale: {
      whyUpdate: '家长指出深度展开不太像，记录校正线索',
      whyNotPromoteSomeItems: '校正信息需多轮验证后再调机制权重',
      riskOfOvergeneralization: '避免单次校正推翻全部画像',
      nextVerificationNeed: trimmed.slice(0, 80),
    },
  })

  void enqueueJob('memory_write', { plan: writePlan, tenant }, `feedback_partial_${turn.traceId}`, turn.traceId)
}

import 'server-only'
import type { EntryEvidencePack, EntryName } from '@/types/database'

/* ================================================================
   EntryEvidencePack（L3 入口证据包）构造器——共享给采集端点与综合端点。
   原先仅存在于 app/api/synthesis/route.ts 内，现抽出以便 /api/entry/analyze
   在采集阶段即写 L3（交付文档闭环 EntryEvidencePack→FamilyModel→Brief→Board）。
   ================================================================ */

export const LEGACY_TO_NEW: Record<string, EntryName> = {
  daily: 'daily_rhythm_phone',
  homework: 'learning_homework',
  communication: 'parent_child_communication',
  family: 'relationship_environment',
  study: 'learning_homework',
  routine: 'daily_rhythm_phone',
  emotion: 'parent_child_communication',
  environment: 'relationship_environment',
}

export function classifyFacts(facts: string[]): {
  childBehaviors: string[]; parentActions: string[]; triggerPoints: string[]; parentEvaluations: string[]
} {
  const childBehaviors: string[] = []
  const parentActions: string[] = []
  const triggerPoints: string[] = []
  const parentEvaluations: string[] = []
  const triggers = ['检查', '抽查', '提醒', '催', '问', '被查', '被问', '要求', '安排', '布置', '追加', '被说']
  for (const f of facts) {
    const t = f.toLowerCase()
    const mentionsChild = t.includes('孩子')
    const mentionsParent = t.includes('家长') || t.includes('妈妈') || t.includes('母亲') || t.includes('爸爸')
    const mentionsTrigger = triggers.some(k => t.includes(k))

    if (mentionsChild || (!mentionsParent && !mentionsTrigger)) childBehaviors.push(f)
    if (mentionsParent) parentActions.push(f)
    if (mentionsTrigger) triggerPoints.push(f)
  }
  return { childBehaviors, parentActions, triggerPoints, parentEvaluations }
}

export function buildEntryPack(
  legacyKey: string,
  data: { rawTexts: string[]; stageSummary?: string; followUps: string[]; aiFacts?: string[]; aiHypotheses?: string[] },
  familyId: string,
  childId: string,
  index: number,
): EntryEvidencePack {
  const entryName = LEGACY_TO_NEW[legacyKey]
  const now = new Date().toISOString()
  const packId = `pack-${Date.now()}-${index}`
  const aiFacts = data.aiFacts || []
  const aiHypotheses = data.aiHypotheses || []
  const classified = classifyFacts(aiFacts)

  return {
    packId,
    familyId,
    childId,
    entryName: entryName || 'learning_homework',
    entryStatus: 'evidence_pack_ready' as const,
    rawInputSummary: data.stageSummary ? `${data.stageSummary} 原始描述：${data.rawTexts.join('；')}` : data.rawTexts.join('；'),
    decomposedInput: {
      verifiableFacts: aiFacts.length > 0 ? aiFacts : data.rawTexts,
      childBehaviors: classified.childBehaviors,
      parentActions: classified.parentActions,
      triggerPoints: classified.triggerPoints,
      parentEvaluations: classified.parentEvaluations,
      parentGoals: [],
      missingInformation: aiHypotheses,
    },
    candidateMechanisms: data.stageSummary ? [{
      mechanismName: `${legacyKey}_local_hypothesis`,
      description: data.stageSummary,
      supportingEvidence: data.rawTexts,
      evidenceStrength: 'medium' as const,
      counterEvidenceOrGap: [],
      needsCrossEntryVerification: true,
      possibleProtectiveFunction: '',
      doNotPromoteToStableProfileYet: true,
    }] : [],
    evidenceUnits: [],
    followupCandidates: [],
    crossEntrySignals: [],
    handoffToSummaryAgent: {
      mostImportantEvidence: data.rawTexts,
      mostLikelyLocalMechanisms: data.stageSummary ? [data.stageSummary] : [],
      mostImportantGaps: aiHypotheses,
      possibleLinksToOtherEntries: [],
      warnings: [],
    },
    alreadyAskedQuestions: data.followUps.map((_, i) => `followup_${i}`),
    createdAt: now,
    updatedAt: now,
  }
}

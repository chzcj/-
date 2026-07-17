import type { BuiltProfileSnapshot } from '@/lib/server/memory/database-manager'
import {
  buildCompletenessFromEntryMap,
  type ProfileBuildEntryModule,
} from '@/lib/profile/build-input'

function mapStrength(s: string | undefined): 'weak' | 'medium' | 'strong' {
  if (s === 'weak') return 'weak'
  if (s === 'strong') return 'strong'
  return 'medium'
}

export function buildSnapshotFromResults(
  syn: Record<string, unknown>,
  diag: Record<string, unknown>,
  entryMap: Record<string, ProfileBuildEntryModule>
): BuiltProfileSnapshot {
  const evidencePaths: BuiltProfileSnapshot['evidence'] = []
  const seenEvidence = new Set<string>()

  for (const cm of (syn.candidateMechanismMatrix as Array<Record<string, unknown>>) || []) {
    const evidenceText = ((cm.supportingEvidence as string[]) || []).slice(0, 2).join('；')
    if (!evidenceText || seenEvidence.has(evidenceText)) continue
    seenEvidence.add(evidenceText)
    evidencePaths.push({
      sourceLabel: `候选机制：${String(cm.mechanismName || '')}`,
      evidenceText,
      explanation: String(cm.applicableScope || cm.description || ''),
      strength: mapStrength(String(cm.overallStrength || '')),
    })
  }

  for (const ev of (syn.crossEntryEvidenceMap as Array<Record<string, unknown>>) || []) {
    const src = ((ev.sourceEntries as string[]) || ['多模块']).join('+')
    const fact = String(
      (ev.surfaceBehaviors as string[])?.[0] || (ev.childReactions as string[])?.[0] || ''
    )
    if (!fact || seenEvidence.has(fact)) continue
    seenEvidence.add(fact)
    evidencePaths.push({
      sourceLabel: `${src} · 跨场景`,
      evidenceText: fact,
      explanation: String(ev.possibleSharedFunction || ''),
      strength: mapStrength(String(ev.evidenceStrength || '')),
    })
  }

  const profileText =
    [
      (diag.secondMeConditionalProfile as string[])?.[0],
      diag.parentMisjudgmentCorrection as string,
    ]
      .filter(Boolean)
      .join('\n\n') || '暂时无法生成稳定画像，建议补充更多模块信息。'

  const chain = diag.primaryMechanismChain as Record<string, string> | undefined
  const mechanismText = chain?.parentAction
    ? [
        `家长常见动作：${chain.parentAction}`,
        `孩子可能接收成：${chain.childReception}`,
        `孩子保护策略：${chain.childProtectionStrategy}`,
        `家长二次解读：${chain.parentSecondInterpretation}`,
        `强化循环：${chain.reinforcingAction}`,
        `短期功能：${chain.shortTermFunction}`,
        `长期代价：${chain.longTermCost}`,
      ].join('\n')
    : ''

  const protectionList =
    ((diag.childSelfProtection as { protectingWhat?: string[] })?.protectingWhat) || []
  const { completeness } = buildCompletenessFromEntryMap(entryMap)

  return {
    completeness,
    coreJudgment: profileText,
    deepMechanism: mechanismText,
    supportFocus:
      protectionList.length > 0
        ? `保护策略：${protectionList.join('、')}；验证点：${((diag.needsFurtherVerification as string[]) || []).join('；')}`
        : undefined,
    evidence: evidencePaths.length > 0 ? evidencePaths : [],
    verificationPoints: ((diag.needsFurtherVerification as string[]) || []).map((v) => ({
      title: '待验证',
      description: v,
    })),
    updatedAt: new Date().toISOString(),
  }
}

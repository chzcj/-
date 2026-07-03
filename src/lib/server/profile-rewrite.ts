import 'server-only'

import { requireFastJson } from '@/lib/server/daily/llm-required'
import {
  getLatestBuiltProfileSnapshot,
  saveBuiltProfileSnapshot,
  getBuildProgress,
  getLatestEvidenceNetwork,
  getLatestChildStructureModel,
  type BuiltProfileSnapshot,
} from '@/lib/server/memory/database-manager'
import { digestUpdateBucketKey, enqueueJob } from '@/lib/server/jobs/queue'
import { humanizeEntryRef } from '@/lib/entry-name-i18n'
import type { TenantId } from '@/lib/server/memory/tenant'

/**
 * 每 2 天登录触发的画像重写 Agent。
 *
 * 不重跑完整 synthesis/diagnosis pipeline（那需要重组 EntryEvidencePack），而是基于已积累的
 * 记忆层材料（旧画像 + 各模块阶段总结 + 跨入口证据网络 + 孩子结构模型），用一次 LLM 调用整体
 * 重写画像文本字段，写入 built_profile_snapshots，再链式 digest_update 刷新 brief/board。
 *
 * 设计目标：让画像界面的 coreJudgment/deepMechanism/evidence/verificationPoints 随交流积累
 * 自动更新，而不是只停留在首次建模快照。
 */
export async function runProfileRewrite(tenant: TenantId): Promise<void> {
  const [prevBuilt, progress, evidenceNetwork, structureModel] = await Promise.all([
    getLatestBuiltProfileSnapshot(tenant),
    getBuildProgress(tenant),
    getLatestEvidenceNetwork(tenant),
    getLatestChildStructureModel(tenant),
  ])

  // 组装 LLM 输入材料
  const stageSummaries = progress?.stageSummaries || []
  const crossEntryEvidence = evidenceNetwork?.crossEntryEvidenceMap || []
  const candidateMechanisms = evidenceNetwork?.candidateMechanismMatrix || []
  const primaryProfile = structureModel?.primaryConditionalProfile || prevBuilt?.coreJudgment || ''

  const material = {
    prevCoreJudgment: prevBuilt?.coreJudgment || '',
    prevDeepMechanism: prevBuilt?.deepMechanism || '',
    prevSupportFocus: prevBuilt?.supportFocus || '',
    prevEvidence: prevBuilt?.evidence || [],
    prevVerificationPoints: prevBuilt?.verificationPoints || [],
    stageSummaries: stageSummaries.map((s) => ({
      entryType: s.entryType,
      mainJudgment: s.mainJudgment,
      facts: s.facts,
      pendingHypotheses: s.pendingHypotheses,
    })),
    crossEntryEvidence: crossEntryEvidence.map((e) => ({
      sourceEntries: e.sourceEntries,
      surfaceBehaviors: e.surfaceBehaviors,
      childReactions: e.childReactions,
      possibleSharedFunction: e.possibleSharedFunction,
    })),
    candidateMechanisms: candidateMechanisms.map((m) => ({
      mechanismName: m.mechanismName,
      description: m.description,
      supportingEvidence: m.supportingEvidence,
      overallStrength: m.overallStrength,
    })),
    primaryConditionalProfile: primaryProfile,
    dominantProtectiveStrategies: structureModel?.dominantProtectiveStrategies || [],
  }

  const system = `你是育见画像重写 Agent。基于系统已积累的记忆层材料，整体重写这个孩子的家长可见画像。

## 输入
你会收到 JSON：prevCoreJudgment/prevDeepMechanism/prevSupportFocus/prevEvidence/prevVerificationPoints（旧画像）、stageSummaries（各模块阶段总结，含 facts/pendingHypotheses）、crossEntryEvidence（跨入口证据）、candidateMechanisms（候选机制）、primaryConditionalProfile/dominantProtectiveStrategies（孩子结构模型）。

## 输出
只输出 JSON，字段固定为：
{
  "coreJudgment": "string，120-220 字，这个孩子在这个家庭流程里的核心判断",
  "deepMechanism": "string，家长动作→孩子接收→保护策略→强化循环→短期功能→长期代价，每行一项",
  "supportFocus": "string，80-160 字，当前最值得家长关注的一个焦点",
  "evidence": [{ "sourceLabel": "string", "evidenceText": "string", "explanation": "string", "strength": "weak|medium|strong" }],
  "verificationPoints": [{ "title": "string", "description": "string" }],
  "completeness": number
}

## 规则
1. 必须基于输入材料重写，不要凭空编造。如果材料不足，保留旧画像对应字段。
2. 全部家长可见语言，禁止出现 learning_homework/daily_rhythm_phone/parent_child_communication 等英文 key，用"学习与作业/日常节奏/亲子沟通"等中文名。
3. evidence 4-6 条，sourceLabel 用"候选机制：xxx"或"模块名 · 跨场景"格式，去重。
4. verificationPoints 2-4 条，写接下来最值得观察的分叉。
5. completeness 0-100，根据 stageSummaries 覆盖模块数 + 证据强度估算。
6. coreJudgment 必须穿透中间变量（控制感/压力/自主权），落到谁催、何时催、做完会不会加任务、孩子第一反应。
7. deepMechanism 每行以"标签：内容"格式，6-7 行。
8. 每个 paragraph 必须以中文句号收尾，禁止半句截断。`

  const result = await requireFastJson<BuiltProfileSnapshotRewrite>(
    system,
    { material },
    { maxTokens: 3072 }
  )

  const now = new Date().toISOString()
  const next: BuiltProfileSnapshot = {
    completeness: Math.max(prevBuilt?.completeness || 0, Math.min(100, result.completeness || prevBuilt?.completeness || 0)),
    coreJudgment: humanizeEntryRef(result.coreJudgment || prevBuilt?.coreJudgment || ''),
    deepMechanism: humanizeEntryRef(result.deepMechanism || prevBuilt?.deepMechanism || ''),
    supportFocus: humanizeEntryRef(result.supportFocus || prevBuilt?.supportFocus || ''),
    evidence: (result.evidence || prevBuilt?.evidence || []).map((e) => ({
      sourceLabel: humanizeEntryRef(e.sourceLabel),
      evidenceText: humanizeEntryRef(e.evidenceText),
      explanation: humanizeEntryRef(e.explanation || ''),
      strength: e.strength || 'medium',
    })),
    verificationPoints: (result.verificationPoints || prevBuilt?.verificationPoints || []).map((v) => ({
      title: v.title,
      description: humanizeEntryRef(v.description || ''),
    })),
    updatedAt: now,
  }

  await saveBuiltProfileSnapshot(next, tenant)

  // 链式刷新 brief/board
  void enqueueJob('digest_update', { tenant }, digestUpdateBucketKey(tenant), null)
}

type BuiltProfileSnapshotRewrite = {
  coreJudgment?: string
  deepMechanism?: string
  supportFocus?: string
  evidence?: Array<{ sourceLabel: string; evidenceText: string; explanation?: string; strength?: 'weak' | 'medium' | 'strong' }>
  verificationPoints?: Array<{ title: string; description?: string }>
  completeness?: number
}

import { agentPrompts } from '@/lib/server/agent-prompts'

/** 四模块采集 JSON 任务：parentFacingStyle（文风铁律，已精简）+ 入口宪法 + 模块 SP。
 *  parentFacingStyle 作为稳定前缀放在最前，利于 DeepSeek prompt cache 跨请求复用。 */
export function buildEntryAnalyzeSystem(agentKey: keyof typeof agentPrompts): string {
  return [agentPrompts.parentFacingStyle, agentPrompts.entryBuildStyle, agentPrompts[agentKey]]
    .filter(Boolean)
    .join('\n\n---\n\n')
}

/** 收尾综合追问 */
export function buildFinalFollowUpSystem(): string {
  return buildEntryAnalyzeSystem('entryFinalFollowUp')
}

/** 四模块跨入口综合建模（后台） */
export function buildProfileSynthesisSystem(): string {
  return [agentPrompts.entryBuildStyle, agentPrompts.profileBuildSynthesis].filter(Boolean).join('\n\n---\n\n')
}

/** 四模块 SecondMe 深度诊断（画像结果页家长可见） */
export function buildProfileDiagnosisSystem(): string {
  return [
    agentPrompts.parentFacingStyle,
    agentPrompts.entryBuildStyle,
    agentPrompts.profileBuildDiagnosis,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')
}

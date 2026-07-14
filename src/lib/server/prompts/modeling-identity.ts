import { agentPrompts, type AgentPromptKey } from '@/lib/server/agent-prompts'

/**
 * 后台建模 / 机制链 Agent：拼 SecondMe 协作者身份 §A+§C 为稳定 system 前缀。
 * 不给纯抽取类（memoryWrite / episodeExtractor）加，避免噪声。
 */

const MODELING_IDENTITY_AGENTS = new Set<AgentPromptKey>([
  'ecosystemClassifier',
  'theoryMatcher',
  'mechanismSynthesizer',
  'deepMechanismReview',
  'structuralRiskExtractor',
  'deepDiagnosis',
  'profileBuildSynthesis',
  'deepModelDigestBuilder',
])

/** 从 secondMeCollaboratorIdentity.md 抽出 §A 与 §C（不含前台 §B）。 */
export function extractModelingIdentityPrefix(fullIdentity: string): string {
  const aMatch = fullIdentity.match(/## A\.\s*公共使命[\s\S]*?(?=\n## B\.|$)/)
  const cMatch = fullIdentity.match(/## C\.\s*后台附加[\s\S]*$/)
  const parts = [aMatch?.[0]?.trim(), cMatch?.[0]?.trim()].filter(Boolean)
  if (parts.length === 0) {
    // 回退：整份身份文件（避免前缀丢失）
    return fullIdentity.trim()
  }
  return parts.join('\n\n')
}

export function usesModelingIdentityPrefix(agent: AgentPromptKey): boolean {
  return MODELING_IDENTITY_AGENTS.has(agent)
}

export function resolveAgentSystem(agent: AgentPromptKey): string {
  const task = agentPrompts[agent]
  if (!usesModelingIdentityPrefix(agent)) return task
  const identity = agentPrompts.secondMeCollaboratorIdentity
  if (!identity) return task
  const prefix = extractModelingIdentityPrefix(identity)
  return `${prefix}\n\n---\n\n${task}`
}

/** 预演等 inline system：只拼建模身份 §A+§C，避免整份 parentFacingStyle 暴涨。 */
export function modelingIdentitySystemPrefix(): string {
  const identity = agentPrompts.secondMeCollaboratorIdentity
  if (!identity) return ''
  return extractModelingIdentityPrefix(identity)
}

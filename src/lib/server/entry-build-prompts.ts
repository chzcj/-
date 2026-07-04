import { agentPrompts } from '@/lib/server/agent-prompts'
import type { AgentPromptKey } from '@/lib/server/agent-prompts'

export type BuildEntryModule = 'daily' | 'homework' | 'communication' | 'family'

const FOLLOW_UP_AGENT: Record<BuildEntryModule, AgentPromptKey> = {
  daily: 'entryDailyFollowUp',
  homework: 'entryHomeworkFollowUp',
  communication: 'entryCommunicationFollowUp',
  family: 'entryFamilyFollowUp',
}

const SUMMARY_AGENT: Record<BuildEntryModule, AgentPromptKey> = {
  daily: 'entryDailySummary',
  homework: 'entryHomeworkSummary',
  communication: 'entryCommunicationSummary',
  family: 'entryFamilySummary',
}

export function isBuildEntryModule(entryType: string): entryType is BuildEntryModule {
  return entryType in FOLLOW_UP_AGENT
}

export function resolveEntryFollowUpAgent(entryType: string): AgentPromptKey {
  if (entryType === 'final') return 'entryFinalFollowUp'
  if (isBuildEntryModule(entryType)) return FOLLOW_UP_AGENT[entryType]
  return 'entryFollowUp'
}

export function resolveEntrySummaryAgent(entryType: string): AgentPromptKey {
  if (isBuildEntryModule(entryType)) return SUMMARY_AGENT[entryType]
  return 'entryStageSummary'
}

/** @deprecated 使用 profile-build-prompts.buildEntryAnalyzeSystem */
export function buildEntrySystemPrompt(agent: AgentPromptKey): string {
  return [agentPrompts.entryBuildStyle, agentPrompts[agent]].filter(Boolean).join('\n\n---\n\n')
}

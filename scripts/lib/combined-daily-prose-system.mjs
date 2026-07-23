/** 与 parent-facing-copy.combinedDailyProseSystem 保持一致（供 CLI 脚本复用） */
export function combinedDailyProseSystem(agentPrompts) {
  return `${agentPrompts.parentFacingStyle}\n\n---\n\n${agentPrompts.deepModelingParentDigest}\n\n---\n\n${agentPrompts.dailyDialogueOrchestration}`
}

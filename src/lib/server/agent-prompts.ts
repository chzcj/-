import { diagnosticAgentPrompt } from '@/lib/server/diagnostic-agent-prompt';
import { promptRegistry } from './prompts/registry.generated';

/* ================================================================
   Agent Prompts 聚合入口。
   各 prompt 源文件在 prompts/{front,background}/*.md（交付文档 8.2 目录化），
   由 scripts/build-prompts.mjs 在 predev/prebuild 编译为 registry.generated.ts（bundled，零运行时 fs）。
   problemJudgment 复用 diagnostic-agent-prompt.ts。
   ================================================================ */
export const agentPrompts = {
  problemJudgment: diagnosticAgentPrompt,
  ...promptRegistry,
} as const;

export type AgentPromptKey = keyof typeof agentPrompts;

import 'server-only'

import type { AgentPromptKey } from '@/lib/server/agent-prompts'
import { callAgentJson, callAgentTextStream, callParentAgentJson, callParentAgentTextStream, callParentJson, callParentTextStream, callFastJson, callFastTextStream, isFastAIEnabled, isParentAIEnabled } from '@/lib/server/ark-agents'
import { filterParentFacingText } from '@/lib/server/daily/parent-facing-filter'

export class DailyLlmRequiredError extends Error {
  readonly code = 'LLM_REQUIRED'

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'DailyLlmRequiredError'
    if (cause instanceof Error) this.cause = cause
  }
}

const DEFAULT_RETRIES = 2

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function assertFastAiConfigured() {
  if (!isFastAIEnabled() && !isParentAIEnabled()) {
    throw new DailyLlmRequiredError('FAST_AI_NOT_CONFIGURED')
  }
}

/** 前台 prose：必须 LLM 成功，失败重试后抛错，无规则兜底 */
export async function requireAgentTextStream(
  agent: AgentPromptKey,
  task: string,
  payload: unknown,
  onDelta?: (delta: string) => void
): Promise<string> {
  assertFastAiConfigured()
  let lastErr: unknown

  for (let attempt = 1; attempt <= DEFAULT_RETRIES; attempt++) {
    try {
      const raw = await callParentAgentTextStream(agent, task, payload, onDelta || (() => {}))
      if (!raw?.trim()) {
        throw new Error('LLM_EMPTY_OUTPUT')
      }
      return filterParentFacingText(raw.trim())
    } catch (err) {
      lastErr = err
      if (attempt < DEFAULT_RETRIES) await sleep(400 * attempt)
    }
  }

  throw new DailyLlmRequiredError('LLM_PROSE_FAILED', lastErr)
}

/** 前台 section / JSON：必须 LLM 成功 */
export async function requireAgentJson<T>(
  agent: AgentPromptKey,
  task: string,
  payload: unknown
): Promise<T> {
  assertFastAiConfigured()
  let lastErr: unknown

  for (let attempt = 1; attempt <= DEFAULT_RETRIES; attempt++) {
    try {
      const raw = await callParentAgentJson<T>(agent, task, payload)
      if (raw === undefined || raw === null) {
        throw new Error('LLM_EMPTY_JSON')
      }
      return raw
    } catch (err) {
      lastErr = err
      if (attempt < DEFAULT_RETRIES) await sleep(400 * attempt)
    }
  }

  throw new DailyLlmRequiredError('LLM_JSON_FAILED', lastErr)
}

/** 自定义 system 的 prose 流式（daily 用 parentFacingStyle + dailyDialogueOrchestration） */
export async function requireTextStream(
  system: string,
  task: string,
  payload: unknown,
  onDelta?: (delta: string) => void,
  options?: { maxTokens?: number }
): Promise<string> {
  assertFastAiConfigured()
  let lastErr: unknown

  for (let attempt = 1; attempt <= DEFAULT_RETRIES; attempt++) {
    try {
      const raw = await callParentTextStream(
        system,
        { task, ...(typeof payload === 'object' && payload ? payload : { input: payload }) },
        onDelta || (() => {}),
        options
      )
      if (!raw?.trim()) throw new Error('LLM_EMPTY_OUTPUT')
      return filterParentFacingText(raw.trim())
    } catch (err) {
      lastErr = err
      if (attempt < DEFAULT_RETRIES) await sleep(400 * attempt)
    }
  }

  throw new DailyLlmRequiredError('LLM_PROSE_FAILED', lastErr)
}

/** 自定义 system 的 JSON（section copy） */
export async function requireFastJson<T>(
  system: string,
  payload: unknown,
  options?: { maxTokens?: number; validate?: (raw: T) => void }
): Promise<T> {
  assertFastAiConfigured()
  let lastErr: unknown

  for (let attempt = 1; attempt <= DEFAULT_RETRIES; attempt++) {
    try {
      const raw = await callParentJson<T>(system, payload, { maxTokens: options?.maxTokens })
      if (raw === undefined || raw === null) throw new Error('LLM_EMPTY_JSON')
      options?.validate?.(raw)
      return raw
    } catch (err) {
      lastErr = err
      if (attempt < DEFAULT_RETRIES) await sleep(400 * attempt)
    }
  }

  throw new DailyLlmRequiredError('LLM_JSON_FAILED', lastErr)
}

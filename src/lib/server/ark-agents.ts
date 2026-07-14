import 'server-only';

import { type AgentPromptKey } from '@/lib/server/agent-prompts';
import { resolveAgentSystem } from '@/lib/server/prompts/modeling-identity';
import {
  fastApiKey, fastModel, fastBase, fastTemp,
  parentApiKey, parentModel, parentBase, parentTemp,
  isParentAIEnabled,
  ensureSettingsLoaded
} from '@/lib/server/settings/runtime-config';

type ArkAgentsGlobal = typeof globalThis & {
  __childosFastWarmupTimer?: ReturnType<typeof setInterval>;
  __childosFastWarmupPromise?: Promise<void>;
  __childosFastWarmupAt?: number;
};

const agentGlobal = globalThis as ArkAgentsGlobal;

// key/model/base/temperature 改由运行时配置层提供（支持管理员面板即时改、无需重启）；
// 这里只留非凭证、无需 UI 改的超时参数为 env const。
// 超时（容错）：上游 LLM 卡住时不让请求无限挂。JSON 用总超时；流式用「无新 chunk」的 idle 超时（不打断正常长输出）。
const FAST_TIMEOUT_MS = Number(process.env.FAST_AI_TIMEOUT_MS || 45_000);
const FAST_STREAM_IDLE_MS = Number(process.env.FAST_AI_STREAM_IDLE_MS || 25_000);

type ModelLane = 'fast' | 'parent';

function laneConfig(lane: ModelLane) {
  if (lane === 'parent' && isParentAIEnabled()) {
    return { apiKey: parentApiKey(), model: parentModel(), base: parentBase(), temp: parentTemp() }
  }
  return { apiKey: fastApiKey(), model: fastModel(), base: fastBase(), temp: fastTemp() }
}

export function isFastAIEnabled() {
  ensureSettingsLoaded();
  return Boolean(fastApiKey() && fastModel());
}

export { isParentAIEnabled } from '@/lib/server/settings/runtime-config';

export function startFastAIWarmupLoop() {
  if (!isFastAIEnabled() || process.env.FAST_AI_WARMUP === 'false') return;
  if (agentGlobal.__childosFastWarmupTimer) return;

  void warmFastAI();
  const interval = Math.max(60_000, Number(process.env.FAST_AI_WARMUP_INTERVAL_MS || 240_000));
  agentGlobal.__childosFastWarmupTimer = setInterval(() => {
    void warmFastAI();
  }, interval);
  agentGlobal.__childosFastWarmupTimer.unref?.();
}

export async function warmFastAI() {
  if (!isFastAIEnabled()) return;
  const minGap = Math.max(30_000, Number(process.env.FAST_AI_WARMUP_MIN_GAP_MS || 60_000));
  if (agentGlobal.__childosFastWarmupAt && Date.now() - agentGlobal.__childosFastWarmupAt < minGap) return;
  if (agentGlobal.__childosFastWarmupPromise) return agentGlobal.__childosFastWarmupPromise;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.FAST_AI_WARMUP_TIMEOUT_MS || 8000));
  agentGlobal.__childosFastWarmupPromise = fetch(`${fastBase()}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${fastApiKey()}`
    },
    body: JSON.stringify({
      model: fastModel(),
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0
    })
  })
    .then(async (response) => {
      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(`FAST_AI_WARMUP_FAILED:${response.status}:${message.slice(0, 120)}`);
      }
      agentGlobal.__childosFastWarmupAt = Date.now();
    })
    .catch((error) => {
      console.error('[childos] fast warmup failed', error);
    })
    .finally(() => {
      clearTimeout(timeout);
      agentGlobal.__childosFastWarmupPromise = undefined;
    });

  return agentGlobal.__childosFastWarmupPromise;
}

export async function callAgentJson<T>(
  agent: AgentPromptKey,
  task: string,
  payload: unknown,
  options?: { maxTokens?: number }
): Promise<T | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleJson<T>({
    system: resolveAgentSystem(agent),
    user: `${task}\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`,
    maxTokens: options?.maxTokens
  });
}

export async function callAgentTextStream(agent: AgentPromptKey, task: string, payload: unknown, onDelta: (delta: string) => void): Promise<string | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleTextStream(
    {
      system: resolveAgentSystem(agent),
      user: `${task}\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
    },
    onDelta
  );
}

export async function callSupportJson<T>(system: string, payload: unknown): Promise<T | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleJson<T>({
    system,
    user: `只输出 JSON，不输出 Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
  });
}

export async function callSupportTextStream(system: string, payload: unknown, onDelta: (delta: string) => void): Promise<string | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleTextStream(
    {
      system,
      user: `只输出要展示给用户的一段中文文本，不输出 JSON、Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
    },
    onDelta
  );
}

export async function callParentJson<T>(
  system: string,
  payload: unknown,
  options?: { maxTokens?: number; disableThinking?: boolean }
): Promise<T | undefined> {
  if (!isParentAIEnabled() && !isFastAIEnabled()) return undefined;
  return callOpenAICompatibleJson<T>({
    system,
    user: `只输出 JSON，不输出 Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`,
    maxTokens: options?.maxTokens,
    disableThinking: options?.disableThinking,
    lane: 'parent',
  });
}

export async function callParentTextStream(
  system: string,
  payload: unknown,
  onDelta: (delta: string) => void,
  options?: { maxTokens?: number; disableThinking?: boolean }
): Promise<string | undefined> {
  if (!isParentAIEnabled() && !isFastAIEnabled()) return undefined;
  return callOpenAICompatibleTextStream(
    {
      system,
      user: `只输出要展示给用户的文本，不输出 Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`,
      maxTokens: options?.maxTokens,
      lane: 'parent',
      disableThinking: options?.disableThinking,
    },
    onDelta
  );
}

export async function callParentAgentJson<T>(agent: AgentPromptKey, task: string, payload: unknown): Promise<T | undefined> {
  if (!isParentAIEnabled() && !isFastAIEnabled()) return undefined;
  return callOpenAICompatibleJson<T>({
    system: resolveAgentSystem(agent),
    user: `${task}\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`,
    lane: 'parent',
  });
}

export async function callParentAgentTextStream(
  agent: AgentPromptKey,
  task: string,
  payload: unknown,
  onDelta: (delta: string) => void
): Promise<string | undefined> {
  if (!isParentAIEnabled() && !isFastAIEnabled()) return undefined;
  return callOpenAICompatibleTextStream(
    {
      system: resolveAgentSystem(agent),
      user: `${task}\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`,
      lane: 'parent',
    },
    onDelta
  );
}

export async function callFastJson<T>(
  system: string,
  payload: unknown,
  options?: { maxTokens?: number }
): Promise<T | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleJson<T>({
    system,
    user: `只输出 JSON，不输出 Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`,
    maxTokens: options?.maxTokens,
    lane: 'fast',
  });
}

export async function callFastTextStream(system: string, payload: unknown, onDelta: (delta: string) => void, options?: { maxTokens?: number; disableThinking?: boolean }): Promise<string | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleTextStream(
    {
      system,
      user: `只输出要展示给用户的文本，不输出 Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`,
      maxTokens: options?.maxTokens,
      disableThinking: options?.disableThinking,
      lane: 'fast',
    },
    onDelta
  );
}

async function callOpenAICompatibleJson<T>({
  system,
  user,
  maxTokens,
  lane = 'fast',
  disableThinking,
}: {
  system: string
  user: string
  maxTokens?: number
  lane?: ModelLane
  disableThinking?: boolean
}): Promise<T | undefined> {
  const { apiKey, model, base, temp } = laneConfig(lane)
  if (!apiKey || !model) return undefined
  // 总超时：上游卡住时 abort，避免请求无限挂（caller 的 .catch 走降级）。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FAST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: temp,
        max_tokens: maxTokens ?? Number(process.env.FAST_AI_JSON_MAX_TOKENS || 2048),
        response_format: { type: 'json_object' },
        // 仅前台表达类调用传入；后台 agent 不传，保留完整思考
        ...(disableThinking ? { thinking: { type: 'disabled' } } : {})
      })
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(`FAST_AI_REQUEST_FAILED:${response.status}:${message.slice(0, 300)}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: CacheUsage };
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('FAST_AI_EMPTY_OUTPUT');
    logCacheHit(`json:${lane}`, model, data.usage);
    return parseJson<T>(text);
  } finally {
    clearTimeout(timer);
  }
}

/** 前台流式调用是否关闭模型隐式思考。
 *  实测（DeepSeek v4-flash）：默认开思考时首 token 2.4s（小 prompt）~12s（生产大 prompt），
 *  关闭后 0.6-0.7s。前台 prose/reaction 的深度来自注入的上下文包（digest+retrievalPack，
 *  后台 agent 已完成思考），表达层无需模型再想一遍——正是「后台深度建模、前台减压」的架构。
 *  后台 agent（机制复核/综合/诊断等）不走此开关，保留完整思考。
 *  回滚开关：环境变量 FRONT_AI_THINKING=on 恢复前台思考。 */
export function frontAiThinkingDisabled(): boolean {
  return process.env.FRONT_AI_THINKING !== 'on'
}

async function callOpenAICompatibleTextStream(
  { system, user, maxTokens, lane = 'fast', disableThinking }: { system: string; user: string; maxTokens?: number; lane?: ModelLane; disableThinking?: boolean },
  onDelta: (delta: string) => void
): Promise<string | undefined> {
  const { apiKey, model, base, temp } = laneConfig(lane)
  if (!apiKey || !model) return undefined
  // idle 超时：每收到一个 chunk 就重置，只在「上游卡住、长时间无新数据」时 abort——不打断正常长输出。
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const bumpIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), FAST_STREAM_IDLE_MS);
  };
  try {
    bumpIdle();
    const tFetchStart = Date.now();
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        stream: true,
        stream_options: { include_usage: true },
        temperature: temp,
        max_tokens: maxTokens ?? Number(process.env.FAST_AI_STREAM_MAX_TOKENS || 1024),
        // thinking 参数放在 body 末尾，不影响 messages 前缀的 prompt cache
        ...(disableThinking ? { thinking: { type: 'disabled' } } : {})
      })
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(`FAST_AI_REQUEST_FAILED:${response.status}:${message.slice(0, 300)}`);
    }

    if (!response.body) return undefined;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let streamUsage: CacheUsage | undefined;
    let tFirstProviderChunk: number | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bumpIdle(); // 收到新数据，重置 idle 计时
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const u = extractStreamUsage(line);
        if (u) streamUsage = u;
        const delta = parseOpenAIStreamLine(line);
        if (!delta) continue;
        if (tFirstProviderChunk === null) {
          tFirstProviderChunk = Date.now();
          console.info(
            `[stream:timing] lane=${lane} model=${model} providerFirstChunkMs=${tFirstProviderChunk - tFetchStart}`
          );
        }
        fullText += delta;
        onDelta(delta);
      }
    }

    const tailUsage = extractStreamUsage(buffer);
    if (tailUsage) streamUsage = tailUsage;
    const tail = parseOpenAIStreamLine(buffer);
    if (tail) {
      fullText += tail;
      onDelta(tail);
    }
    logCacheHit(`stream:${lane}`, model, streamUsage);
    return fullText.trim() || undefined;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }
}

function parseOpenAIStreamLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed === 'data: [DONE]') return '';
  const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!data || data === '[DONE]') return '';
  try {
    const event = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
    return event.choices?.[0]?.delta?.content || '';
  } catch {
    return '';
  }
}

/** 流式末尾 chunk（choices 为空）携带 usage；逐行扫描捕获，供 cache 命中观测。 */
function extractStreamUsage(line: string): CacheUsage | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed === 'data: [DONE]') return undefined;
  const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!data || data === '[DONE]') return undefined;
  try {
    const event = JSON.parse(data) as { usage?: CacheUsage };
    return event.usage;
  } catch {
    return undefined;
  }
}

function parseJson<T>(text: string): T | undefined {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error('FAST_AI_JSON_PARSE_FAILED');
  }
}

/* DeepSeek prompt cache 可观测：读取 usage.prompt_cache_hit_tokens / miss_tokens 并打日志。
   DeepSeek 自动按「从第 0 token 起字节一致的前缀」缓存，命中价约 1/10。这里只观测，不改请求。 */
interface CacheUsage {
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
  total_tokens?: number
}

function logCacheHit(scope: string, model: string, usage?: CacheUsage): void {
  if (!usage) return
  const hit = usage.prompt_cache_hit_tokens ?? 0
  const miss = usage.prompt_cache_miss_tokens ?? 0
  const total = hit + miss
  const rate = total > 0 ? Math.round((hit / total) * 100) : 0
  console.info(`[cache:${scope}] model=${model} hit=${hit} miss=${miss} rate=${rate}%`)
}

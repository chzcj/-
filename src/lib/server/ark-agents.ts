import 'server-only';

import { agentPrompts, type AgentPromptKey } from '@/lib/server/agent-prompts';

type ArkAgentsGlobal = typeof globalThis & {
  __childosFastWarmupTimer?: ReturnType<typeof setInterval>;
  __childosFastWarmupPromise?: Promise<void>;
  __childosFastWarmupAt?: number;
};

const agentGlobal = globalThis as ArkAgentsGlobal;

const FAST_API_KEY = process.env.FAST_AI_API_KEY || '';
const FAST_MODEL = process.env.FAST_AI_MODEL || 'deepseek-v4-flash';
const FAST_BASE = (process.env.FAST_AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
const FAST_TEMP = Number(process.env.FAST_AI_TEMPERATURE || 0.25);

export function isFastAIEnabled() {
  return Boolean(FAST_API_KEY && FAST_MODEL);
}

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
  agentGlobal.__childosFastWarmupPromise = fetch(`${FAST_BASE}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FAST_API_KEY}`
    },
    body: JSON.stringify({
      model: FAST_MODEL,
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

export async function callAgentJson<T>(agent: AgentPromptKey, task: string, payload: unknown): Promise<T | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleJson<T>({
    system: agentPrompts[agent],
    user: `${task}\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
  });
}

export async function callAgentTextStream(agent: AgentPromptKey, task: string, payload: unknown, onDelta: (delta: string) => void): Promise<string | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleTextStream(
    {
      system: agentPrompts[agent],
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

export async function callFastJson<T>(system: string, payload: unknown): Promise<T | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleJson<T>({
    system,
    user: `只输出 JSON，不输出 Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
  });
}

export async function callFastTextStream(system: string, payload: unknown, onDelta: (delta: string) => void): Promise<string | undefined> {
  if (!isFastAIEnabled()) return undefined;
  return callOpenAICompatibleTextStream(
    {
      system,
      user: `只输出要展示给用户的文本，不输出 Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
    },
    onDelta
  );
}

async function callOpenAICompatibleJson<T>({ system, user }: { system: string; user: string }): Promise<T | undefined> {
  const response = await fetch(`${FAST_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FAST_API_KEY}`
    },
    body: JSON.stringify({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: FAST_TEMP,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`FAST_AI_REQUEST_FAILED:${response.status}:${message.slice(0, 300)}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('FAST_AI_EMPTY_OUTPUT');
  return parseJson<T>(text);
}

async function callOpenAICompatibleTextStream({ system, user }: { system: string; user: string }, onDelta: (delta: string) => void): Promise<string | undefined> {
  const response = await fetch(`${FAST_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FAST_API_KEY}`
    },
    body: JSON.stringify({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      stream: true,
      temperature: FAST_TEMP
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const delta = parseOpenAIStreamLine(line);
      if (!delta) continue;
      fullText += delta;
      onDelta(delta);
    }
  }

  const tail = parseOpenAIStreamLine(buffer);
  if (tail) {
    fullText += tail;
    onDelta(tail);
  }
  return fullText.trim() || undefined;
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

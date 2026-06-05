import 'server-only';

import { agentPrompts, type AgentPromptKey } from '@/lib/server/agent-prompts';

interface ArkResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

type ArkAgentsGlobal = typeof globalThis & {
  __childosFastWarmupTimer?: ReturnType<typeof setInterval>;
  __childosFastWarmupPromise?: Promise<void>;
  __childosFastWarmupAt?: number;
};

const agentGlobal = globalThis as ArkAgentsGlobal;

export function isArkEnabled() {
  return process.env.AI_PROVIDER === 'ark' && Boolean(process.env.ARK_API_KEY && process.env.ARK_MODEL);
}

export function isFastAIEnabled() {
  return Boolean(process.env.FAST_AI_API_KEY && process.env.FAST_AI_MODEL);
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

  const baseUrl = (process.env.FAST_AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.FAST_AI_WARMUP_TIMEOUT_MS || 8000));
  agentGlobal.__childosFastWarmupPromise = fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FAST_AI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.FAST_AI_MODEL,
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
  if (!isArkEnabled()) return undefined;
  return callArkJson<T>({
    system: agentPrompts[agent],
    user: `${task}\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
  });
}

export async function callAgentTextStream(agent: AgentPromptKey, task: string, payload: unknown, onDelta: (delta: string) => void): Promise<string | undefined> {
  if (!isArkEnabled()) return undefined;
  return callArkTextStream(
    {
      system: agentPrompts[agent],
      user: `${task}\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
    },
    onDelta
  );
}

export async function callSupportJson<T>(system: string, payload: unknown): Promise<T | undefined> {
  if (!isArkEnabled()) return undefined;
  return callArkJson<T>({
    system,
    user: `只输出 JSON，不输出 Markdown 或解释。\n\n输入上下文 JSON：\n${JSON.stringify(payload, null, 2)}`
  });
}

export async function callSupportTextStream(system: string, payload: unknown, onDelta: (delta: string) => void): Promise<string | undefined> {
  if (!isArkEnabled()) return undefined;
  return callArkTextStream(
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
  const baseUrl = (process.env.FAST_AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FAST_AI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.FAST_AI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: Number(process.env.FAST_AI_TEMPERATURE || 0.25),
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
  const baseUrl = (process.env.FAST_AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FAST_AI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.FAST_AI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      stream: true,
      temperature: Number(process.env.FAST_AI_TEMPERATURE || 0.25)
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

async function callArkJson<T>({ system, user }: { system: string; user: string }): Promise<T | undefined> {
  const baseUrl = (process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ARK_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.ARK_MODEL,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: system }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: user }]
        }
      ],
      temperature: Number(process.env.ARK_TEMPERATURE || 0.35)
    })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`ARK_REQUEST_FAILED:${response.status}:${message.slice(0, 300)}`);
  }

  const data = (await response.json()) as ArkResponse;
  const text = extractText(data);
  if (!text) throw new Error('ARK_EMPTY_OUTPUT');
  return parseJson<T>(text);
}

async function callArkTextStream({ system, user }: { system: string; user: string }, onDelta: (delta: string) => void): Promise<string | undefined> {
  const baseUrl = (process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ARK_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.ARK_MODEL,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: system }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: user }]
        }
      ],
      stream: true,
      temperature: Number(process.env.ARK_TEMPERATURE || 0.35)
    })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`ARK_REQUEST_FAILED:${response.status}:${message.slice(0, 300)}`);
  }

  if (!response.body) {
    const data = (await response.json()) as ArkResponse;
    const text = extractText(data);
    if (text) onDelta(text);
    return text;
  }

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
      const delta = parseStreamLine(line);
      if (!delta) continue;
      fullText += delta;
      onDelta(delta);
    }
  }

  const tail = parseStreamLine(buffer);
  if (tail) {
    fullText += tail;
    onDelta(tail);
  }

  return fullText.trim() || undefined;
}

function parseStreamLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed === 'data: [DONE]') return '';
  const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!data || data === '[DONE]') return '';
  try {
    return extractDelta(JSON.parse(data));
  } catch {
    return '';
  }
}

function extractDelta(event: unknown): string {
  if (!event || typeof event !== 'object') return '';
  const data = event as Record<string, unknown>;
  if (typeof data.delta === 'string') return data.delta;
  if (typeof data.output_text === 'string') return data.output_text;
  const choices = data.choices as Array<{ delta?: { content?: string }; message?: { content?: string } }> | undefined;
  return choices?.[0]?.delta?.content || choices?.[0]?.message?.content || '';
}

function extractText(data: ArkResponse) {
  if (typeof data.output_text === 'string') return data.output_text;
  const outputText = data.output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text)
    .filter(Boolean)
    .join('\n');
  if (outputText) return outputText;
  return data.choices?.[0]?.message?.content || '';
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
    throw new Error('ARK_JSON_PARSE_FAILED');
  }
}

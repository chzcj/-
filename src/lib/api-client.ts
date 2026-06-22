'use client';

import type {
  ApiResult,
  ArchiveDraft,
  AuthUser,
  CardFeedbackType,
  ConfirmArchiveResponse,
  ConversationStateData,
  GenerateAdviceResponse,
  GenerateRehearsalResponse,
  GenerateUnderstandingResponse,
  InputMode,
  ProfileSnapshotData,
  RecordChildResponse,
  StartConversationResponse,
  SubmitProblemAnswerResponse,
  UnderstandingFeedbackResponse
} from '@/types/childos';

// ---- 管理员后台类型 ----
export interface AdminAIConfigStatus {
  fastAi: { configured: boolean; model: string; baseUrl: string; temperature: number; apiKeyMasked: string; apiKeySet: boolean; source: string };
  embedding: { configured: boolean; model: string; baseUrl: string; apiKeyMasked: string; apiKeySet: boolean; source: string };
}
export interface AdminOverview {
  system: {
    databaseConfigured: boolean; databaseReady: boolean; vectorReady: boolean;
    fastConfigured: boolean; embeddingConfigured: boolean; mockMode: boolean;
    mockModeInProduction: boolean; cookieSecure: boolean; nodeEnv: string;
  };
  business: Record<string, number | boolean | string | undefined>;
  jobs: {
    byType: Record<string, Record<string, number>>;
    totals: { pending: number; running: number; retrying: number; succeeded: number; failed: number };
    recentFailures: Array<{ jobType: string; attempts: number; maxAttempts: number; lastError: string; at: string }>;
  };
  ai: AdminAIConfigStatus;
}
export interface AdminConfigInput {
  fastAi?: { apiKey?: string; baseUrl?: string; model?: string; temperature?: number };
  embedding?: { apiKey?: string; baseUrl?: string; model?: string };
}

function fallbackError(detail?: unknown): ApiResult<never> {
  return {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: '今天有点忙，我们稍后再试。', detail, errorType: 'temporary', retriable: true },
    requestId: 'client_error'
  };
}

function normalizeResult<T>(json: unknown): ApiResult<T> {
  if (!json || typeof json !== 'object') return fallbackError('empty_response');
  const maybe = json as Partial<ApiResult<T>>;
  if (maybe.ok === true && 'data' in maybe && typeof maybe.requestId === 'string') {
    return maybe as ApiResult<T>;
  }
  if (maybe.ok === false && maybe.error && typeof maybe.error === 'object' && typeof maybe.requestId === 'string') {
    return maybe as ApiResult<T>;
  }
  return fallbackError(json);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  // GET 幂等：对临时可重试错误(retriable)与网络异常自动重试一次；POST 等非幂等不自动重试，避免重复写。
  const method = (init?.method || 'GET').toUpperCase();
  const canRetry = method === 'GET';
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(path, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {})
        }
      });
      const json = await response.json().catch(() => undefined);
      const result = normalizeResult<T>(json);
      if (!response.ok && result.ok) return fallbackError({ status: response.status, path });
      if (!result.ok && result.error.retriable && canRetry && attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      return result;
    } catch (error) {
      if (canRetry && attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      return fallbackError(String(error));
    }
  }
}

function handleStreamLine(
  line: string,
  handlers: {
    onStart?: (round: number) => void;
    onDelta?: (delta: string) => void;
    onFinal?: (data: SubmitProblemAnswerResponse) => void;
    onError?: (message: string) => void;
  }
) {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const event = JSON.parse(trimmed) as { type?: string; round?: number; delta?: string; data?: SubmitProblemAnswerResponse; message?: string };
    if (event.type === 'start' && typeof event.round === 'number') handlers.onStart?.(event.round);
    if (event.type === 'delta' && typeof event.delta === 'string') handlers.onDelta?.(event.delta);
    if (event.type === 'final' && event.data) handlers.onFinal?.(event.data);
    if (event.type === 'error') handlers.onError?.(event.message || '这次输入没有整理成功，可以再试一次。');
  } catch {
    handlers.onError?.('这次输入没有整理成功，可以再试一次。');
  }
}

export const apiClient = {
  getMe(init?: RequestInit) {
    return requestJson<{ user: AuthUser | null }>('/api/auth/me', init);
  },
  login(input: { phone: string; password: string }, init?: RequestInit) {
    return requestJson<{ user: AuthUser }>('/api/auth/login', {
      ...init,
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  demoLogin(init?: RequestInit) {
    return requestJson<{ user: AuthUser }>('/api/auth/demo', {
      ...init,
      method: 'POST',
      body: JSON.stringify({})
    });
  },
  register(input: { phone: string; password: string }, init?: RequestInit) {
    return requestJson<{ user: AuthUser }>('/api/auth/register', {
      ...init,
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  logout(init?: RequestInit) {
    return requestJson<{ loggedOut: true }>('/api/auth/logout', {
      ...init,
      method: 'POST',
      body: JSON.stringify({})
    });
  },
  startConversation(familyId = 'f_demo', childId = 'c_demo', init?: RequestInit) {
    return requestJson<StartConversationResponse>('/api/conversations/start', {
      ...init,
      method: 'POST',
      body: JSON.stringify({ familyId, childId, entry: 'problem' })
    });
  },
  getConversationState(conversationId: string, init?: RequestInit) {
    return requestJson<ConversationStateData>(`/api/conversations/${conversationId}/state`, init);
  },
  submitProblemAnswer(input: { conversationId: string; round: number; inputMode: InputMode; text: string }, init?: RequestInit) {
    return requestJson<SubmitProblemAnswerResponse>('/api/problem/answer', {
      ...init,
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  async submitProblemAnswerStream(
    input: { conversationId: string; round: number; inputMode: InputMode; text: string },
    handlers: {
      onStart?: (round: number) => void;
      onDelta?: (delta: string) => void;
      onFinal?: (data: SubmitProblemAnswerResponse) => void;
      onError?: (message: string) => void;
    },
    init?: RequestInit
  ) {
    try {
      const response = await fetch('/api/problem/answer/stream', {
        ...init,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {})
        },
        body: JSON.stringify(input)
      });
      if (!response.ok || !response.body) {
        handlers.onError?.('这次输入没有整理成功，可以再试一次。');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach((line) => handleStreamLine(line, handlers));
      }
      if (buffer) handleStreamLine(buffer, handlers);
    } catch {
      handlers.onError?.('这次输入没有整理成功，可以再试一次。');
    }
  },
  generateUnderstandingCard(conversationId: string, init?: RequestInit) {
    return requestJson<GenerateUnderstandingResponse>('/api/understanding/generate', {
      ...init,
      method: 'POST',
      body: JSON.stringify({ conversationId })
    });
  },
  submitUnderstandingFeedback(input: { conversationId: string; cardId: string; feedbackType: CardFeedbackType; text?: string }, init?: RequestInit) {
    return requestJson<UnderstandingFeedbackResponse>('/api/understanding/feedback', {
      ...init,
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  generateRehearsal(input: { conversationId: string; cardId: string; parentText: string }, init?: RequestInit) {
    return requestJson<GenerateRehearsalResponse>('/api/rehearsal/analyze', {
      ...init,
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  async submitRehearsalStream(
    input: { conversationId: string; text: string },
    handlers: {
      onDelta?: (delta: string) => void;
      onFinal?: (text: string) => void;
      onError?: (message: string) => void;
    },
    init?: RequestInit
  ) {
    try {
      const response = await fetch('/api/rehearsal/stream', {
        ...init,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {})
        },
        body: JSON.stringify(input)
      });
      if (!response.ok || !response.body) {
        handlers.onError?.('这次输入没有整理成功，可以再试一次。');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as { type?: string; delta?: string; text?: string; message?: string };
            if (event.type === 'delta' && typeof event.delta === 'string') handlers.onDelta?.(event.delta);
            if (event.type === 'final' && typeof event.text === 'string') handlers.onFinal?.(event.text);
            if (event.type === 'error') handlers.onError?.(event.message || '这次输入没有整理成功，可以再试一次。');
          } catch {
            handlers.onError?.('这次输入没有整理成功，可以再试一次。');
          }
        }
      }
      if (buffer) {
        const trimmed = buffer.trim();
        if (trimmed) {
          try {
            const event = JSON.parse(trimmed) as { type?: string; delta?: string; text?: string; message?: string };
            if (event.type === 'final' && typeof event.text === 'string') handlers.onFinal?.(event.text);
          } catch { /* ignore trailing incomplete line */ }
        }
      }
    } catch {
      handlers.onError?.('这次输入没有整理成功，可以再试一次。');
    }
  },
  generateAdvice(input: { conversationId: string; cardId: string }, init?: RequestInit) {
    return requestJson<GenerateAdviceResponse>('/api/advice/generate', {
      ...init,
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  getArchiveDraft(input: { conversationId: string; cardId?: string; rehearsalId?: string; adviceId?: string }, init?: RequestInit) {
    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return requestJson<ArchiveDraft>(`/api/archive/draft?${params.toString()}`, init);
  },
  confirmArchive(conversationId: string, archive: ArchiveDraft, init?: RequestInit) {
    return requestJson<ConfirmArchiveResponse>('/api/archive/confirm', {
      ...init,
      method: 'POST',
      body: JSON.stringify({ conversationId, archive })
    });
  },
  recordChild(input: { familyId?: string; childId?: string; eventText: string; changeText: string; worryText: string }, init?: RequestInit) {
    return requestJson<RecordChildResponse>('/api/record-child', {
      ...init,
      method: 'POST',
      body: JSON.stringify({ familyId: 'f_demo', childId: 'c_demo', ...input })
    });
  },
  analyzeMaterial(input: { materialText: string; materialType?: string; familyId?: string; childId?: string }, init?: RequestInit) {
    return requestJson<{ traceId: string; reading: string; keyPoints: string[] }>('/api/material-understanding', {
      ...init,
      method: 'POST',
      body: JSON.stringify({ familyId: 'f_demo', childId: 'c_demo', materialType: 'other', ...input })
    });
  },
  getProfileSnapshot(input: { familyId?: string; childId?: string } = {}, init?: RequestInit) {
    const params = new URLSearchParams({
      familyId: input.familyId || 'f_demo',
      childId: input.childId || 'c_demo'
    });
    return requestJson<ProfileSnapshotData>(`/api/profile/snapshot?${params.toString()}`, init);
  },
  getWeeklyReview(input: { familyId?: string; childId?: string } = {}, init?: RequestInit) {
    const params = new URLSearchParams({
      familyId: input.familyId || 'f_demo',
      childId: input.childId || 'c_demo'
    });
    return requestJson<{
      sessionCount: number;
      recentClues: Array<{ type: string; title: string; content: string; createdAt?: string }>;
      childEvents: Array<{ title: string; eventText: string; createdAt?: string }>;
      weeklySummary: string;
    }>(`/api/profile/weekly-review?${params.toString()}`, init);
  },
  adminOverview(init?: RequestInit) {
    return requestJson<AdminOverview>('/api/admin/overview', init);
  },
  adminGetConfig(init?: RequestInit) {
    return requestJson<{ config: AdminAIConfigStatus; encryptionAvailable: boolean }>('/api/admin/config', init);
  },
  adminSaveConfig(input: AdminConfigInput, init?: RequestInit) {
    return requestJson<{ config: AdminAIConfigStatus }>('/api/admin/config', {
      ...init,
      method: 'POST',
      body: JSON.stringify(input)
    });
  }
};

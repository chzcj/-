'use client';

import type {
  ApiResult,
  ArchiveDraft,
  CardFeedbackType,
  ConfirmArchiveResponse,
  ConversationStateData,
  GenerateAdviceResponse,
  GenerateRehearsalResponse,
  GenerateUnderstandingResponse,
  InputMode,
  StartConversationResponse,
  SubmitProblemAnswerResponse,
  UnderstandingFeedbackResponse
} from '@/types/childos';

function fallbackError(detail?: unknown): ApiResult<never> {
  return {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: '今天有点忙，我们稍后再试。', detail },
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
    return result;
  } catch (error) {
    return fallbackError(String(error));
  }
}

export const apiClient = {
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
  }
};

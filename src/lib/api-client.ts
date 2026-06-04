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

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    });
    const json = (await response.json()) as ApiResult<T>;
    return json;
  } catch (error) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: '今天有点忙，我们稍后再试。', detail: String(error) },
      requestId: 'client_error'
    };
  }
}

export const apiClient = {
  startConversation(familyId = 'f_demo', childId = 'c_demo') {
    return requestJson<StartConversationResponse>('/api/conversations/start', {
      method: 'POST',
      body: JSON.stringify({ familyId, childId, entry: 'problem' })
    });
  },
  getConversationState(conversationId: string) {
    return requestJson<ConversationStateData>(`/api/conversations/${conversationId}/state`);
  },
  submitProblemAnswer(input: { conversationId: string; round: number; inputMode: InputMode; text: string }) {
    return requestJson<SubmitProblemAnswerResponse>('/api/problem/answer', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  generateUnderstandingCard(conversationId: string) {
    return requestJson<GenerateUnderstandingResponse>('/api/understanding/generate', {
      method: 'POST',
      body: JSON.stringify({ conversationId })
    });
  },
  submitUnderstandingFeedback(input: { conversationId: string; cardId: string; feedbackType: CardFeedbackType; text?: string }) {
    return requestJson<UnderstandingFeedbackResponse>('/api/understanding/feedback', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  generateRehearsal(input: { conversationId: string; cardId: string; parentText: string }) {
    return requestJson<GenerateRehearsalResponse>('/api/rehearsal/analyze', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  generateAdvice(input: { conversationId: string; cardId: string }) {
    return requestJson<GenerateAdviceResponse>('/api/advice/generate', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  getArchiveDraft(input: { conversationId: string; cardId?: string; rehearsalId?: string; adviceId?: string }) {
    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return requestJson<ArchiveDraft>(`/api/archive/draft?${params.toString()}`);
  },
  confirmArchive(conversationId: string, archive: ArchiveDraft) {
    return requestJson<ConfirmArchiveResponse>('/api/archive/confirm', {
      method: 'POST',
      body: JSON.stringify({ conversationId, archive })
    });
  }
};

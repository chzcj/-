'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useState } from 'react';
import { QuestionCard } from '@/components/cards/QuestionCard';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';
import type { InputMode } from '@/types/childos';

function RehearsalInputPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const cardId = params.get('cardId') || undefined;
  const standalone = params.get('standalone') === '1';
  const { setConversationId, setRehearsalResult } = useConversationStore();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  async function submit(text: string, _: InputMode) {
    setLoading(true);
    setToast('');
    let activeConversationId = conversationId;
    let activeCardId = cardId || 'standalone_card';

    if (!activeConversationId) {
      const started = await apiClient.startConversation();
      if (!started.ok) {
        setLoading(false);
        setToast(started.error.message);
        return;
      }
      activeConversationId = started.data.conversationId;
      activeCardId = 'standalone_card';
      setConversationId(activeConversationId);
    }

    const result = await apiClient.generateRehearsal({ conversationId: activeConversationId, cardId: activeCardId, parentText: text });
    setLoading(false);
    if (!result.ok) {
      setToast(result.error.message);
      return;
    }
    setRehearsalResult(result.data.result);
    router.push(`/rehearsal/result?conversationId=${activeConversationId}&cardId=${activeCardId}&rehearsalId=${result.data.rehearsalId}&standalone=${standalone ? '1' : '0'}`);
  }

  return (
    <AppShell>
      <div className="page">
        <TopProgressBar title="沟通预演" showProgress={false} />
        <QuestionCard
          badge={standalone ? '独立预演' : '先试说一句'}
          question="接下来你会和孩子说什么呢？"
          hint={standalone ? '这里可以不经过完整对话，直接试一句今晚准备对孩子说的话。' : '只需要一句你最可能开口说的话，系统会帮你看看孩子可能怎么听。'}
        />
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint={loading ? '正在整理...' : '说一句你准备开口的话'} disabled={loading} onSubmit={submit} />
    </AppShell>
  );
}

export default function RehearsalInputPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <RehearsalInputPageContent />
    </Suspense>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { QuestionCard } from '@/components/cards/QuestionCard';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar';
import { ErrorState } from '@/components/states/ErrorState';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';
import type { ConversationStateData, InputMode } from '@/types/childos';

function ProblemStartPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const { hydrateState } = useConversationStore();
  const [state, setState] = useState<ConversationStateData | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!conversationId) return;
    apiClient.getConversationState(conversationId).then((result) => {
      if (result.ok) {
        setState(result.data);
        hydrateState(result.data);
      } else setError(result.error.message);
    });
  }, [conversationId, hydrateState]);

  async function submit(text: string, inputMode: InputMode) {
    if (!conversationId) return;
    setLoading(true);
    const result = await apiClient.submitProblemAnswer({ conversationId, round: 1, inputMode, text });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push(`/problem/follow-up?conversationId=${conversationId}&round=${result.data.a1.progress.currentRound}`);
  }

  if (!conversationId || error) {
    return (
      <AppShell>
        <div className="page without-voice">
          <ErrorState title="没有找到这次整理" description={error || '可以回到首页重新开始。'} primaryLabel="回到首页" onPrimary={() => router.push('/home')} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page">
        <TopProgressBar leftAction="close" progress={12} status="问题梳理中 · 第 1 轮" onLeftClick={() => router.push('/home')} />
        <QuestionCard badge="先从一件小事开始" question={state?.firstPrompt.question || '最近有没有一件让你有点挂心的小事，想先和我说说？'} hint={state?.firstPrompt.hint} />
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint={loading ? '正在整理...' : '按住说，或者点键盘打字'} disabled={loading} onSubmit={submit} />
    </AppShell>
  );
}

export default function ProblemStartPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <ProblemStartPageContent />
    </Suspense>
  );
}

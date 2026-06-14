'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { QuestionCard } from '@/components/cards/QuestionCard';
import { ReflectionCard } from '@/components/cards/ReflectionCard';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingResult } from '@/components/states/LoadingResult';
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar';
import { apiClient } from '@/lib/api-client';
import type { ConversationStateData, InputMode } from '@/types/childos';

function ConfirmPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const conversationId = params.get('conversationId') || undefined;
  const [state, setState] = useState<ConversationStateData | undefined>();
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(conversationId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!conversationId) return;
    let mounted = true;
    const controller = new AbortController();
    setRestoring(true);
    apiClient.getConversationState(conversationId, { signal: controller.signal }).then((result) => {
      if (!mounted) return;
      if (result.ok) setState(result.data);
      else setError(result.error.message);
      setRestoring(false);
    });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [conversationId]);

  async function supplement(text: string, inputMode: InputMode) {
    if (!conversationId || !state || loading) return;
    try {
      setLoading(true);
      const result = await apiClient.submitProblemAnswer({ conversationId, round: state.currentRound, inputMode, text });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/problem/confirm?conversationId=${conversationId}`);
    } finally {
      setLoading(false);
    }
  }

  if (!conversationId || error) {
    return (
      <AppShell>
        <div className="page without-voice">
          <ErrorState title="收束页没有恢复成功" description={error || '可以回到首页重新开始。'} primaryLabel="回到首页" onPrimary={() => router.push('/home')} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page">
        <TopProgressBar progress={88} status="准备生成孩子理解卡" />
        <div className="stack">
          {restoring ? <LoadingResult title="正在恢复这次整理" messages={['我在找回刚刚的上下文。']} /> : null}
          {!restoring && state?.latestA1?.assistantMessage ? <ReflectionCard title="整理到这里" text={state.latestA1.assistantMessage.text} /> : null}
          {!restoring ? <QuestionCard question={state?.latestA1?.highlightQuestion.text || '生成孩子理解卡前，你还有想补充的吗？'} hint="不需要一次就完全准确，我们可以一起慢慢改。" /> : null}
          <div className="button-row">
            <PrimaryButton onClick={() => router.push(`/problem/generating?conversationId=${conversationId}`)} disabled={restoring}>帮我生成孩子理解卡</PrimaryButton>
            <SecondaryButton onClick={() => setSupplementOpen(true)} disabled={restoring || loading}>我还有些想补充的细节</SecondaryButton>
          </div>
        </div>
      </div>
      {supplementOpen ? <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint="说一个关键补充就好" disabled={loading || restoring} onSubmit={supplement} /> : null}
    </AppShell>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <ConfirmPageContent />
    </Suspense>
  );
}

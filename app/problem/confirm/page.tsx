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
  const [error, setError] = useState('');

  useEffect(() => {
    if (!conversationId) return;
    apiClient.getConversationState(conversationId).then((result) => {
      if (result.ok) setState(result.data);
      else setError(result.error.message);
    });
  }, [conversationId]);

  async function supplement(text: string, inputMode: InputMode) {
    if (!conversationId || !state) return;
    setLoading(true);
    const result = await apiClient.submitProblemAnswer({ conversationId, round: Math.min(state.currentRound, 7), inputMode, text });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push(`/problem/confirm?conversationId=${conversationId}`);
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
          {state?.latestA1?.assistantMessage ? <ReflectionCard title="整理到这里" text={state.latestA1.assistantMessage.text} /> : null}
          <QuestionCard question={state?.latestA1?.highlightQuestion.text || '生成孩子理解卡前，你还有想补充的吗？'} hint="不需要一次就完全准确，我们可以一起慢慢改。" />
          <div className="button-row">
            <PrimaryButton onClick={() => router.push(`/problem/generating?conversationId=${conversationId}`)}>帮我生成孩子理解卡</PrimaryButton>
            <SecondaryButton onClick={() => setSupplementOpen(true)}>我还有些想补充的细节</SecondaryButton>
          </div>
        </div>
      </div>
      {supplementOpen ? <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint="说一个关键补充就好" disabled={loading} onSubmit={supplement} /> : null}
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

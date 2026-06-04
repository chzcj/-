'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { QuestionCard } from '@/components/cards/QuestionCard';
import { ReflectionCard } from '@/components/cards/ReflectionCard';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingResult } from '@/components/states/LoadingResult';
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';
import type { A1Output, ConversationStateData, InputMode } from '@/types/childos';

function FollowUpPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const roundParam = Number(params.get('round') || '2');
  const { hydrateState } = useConversationStore();
  const [state, setState] = useState<ConversationStateData | undefined>();
  const [a1, setA1] = useState<A1Output | undefined>();
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
      if (result.ok) {
        setState(result.data);
        hydrateState(result.data);
        setA1(result.data.latestA1);
      } else setError(result.error.message);
      setRestoring(false);
    });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [conversationId, hydrateState]);

  const currentA1 = useMemo(() => a1 || state?.latestA1, [a1, state]);
  const currentRound = currentA1?.progress.currentRound || roundParam;

  async function submit(text: string, inputMode: InputMode) {
    if (!conversationId || loading) return;
    try {
      setLoading(true);
      setError('');
      const result = await apiClient.submitProblemAnswer({ conversationId, round: currentRound, inputMode, text });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.data.nextAction === 'confirm_generate_card' || result.data.nextAction === 'generate_draft_card') {
        router.push(`/problem/confirm?conversationId=${conversationId}`);
        return;
      }
      setA1(result.data.a1);
      router.push(`/problem/follow-up?conversationId=${conversationId}&round=${result.data.a1.progress.currentRound}`);
    } finally {
      setLoading(false);
    }
  }

  if (!conversationId || error || (!restoring && !currentA1)) {
    return (
      <AppShell>
        <div className="page without-voice">
          <ErrorState title="追问没有恢复成功" description={error || '如果刚开始流程，可以回到首页重新进入。'} primaryLabel="回到首页" onPrimary={() => router.push('/home')} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page">
        <TopProgressBar progress={(currentRound / 8) * 100} status={`问题梳理中 · 第 ${currentRound} 轮`} />
        {restoring || !currentA1 ? (
          <LoadingResult title="正在恢复这次整理" messages={['我在找回刚刚的上下文。']} />
        ) : (
          <div className="stack">
            {currentA1.ui.showReflectionCard && currentA1.assistantMessage ? <ReflectionCard key={`reflection-${currentRound}`} title={currentRound === 3 ? '我先看到两个线索' : '我先理解一下'} text={currentA1.assistantMessage.text} /> : null}
            <QuestionCard
              key={`question-${currentRound}`}
              badge="只问一个关键点"
              question={currentA1.highlightQuestion.text}
              hint={currentA1.highlightQuestion.inputHint}
              choices={currentA1.ui.quickChoices}
              disabled={loading}
              onChoiceClick={(value) => submit(value, 'text')}
            />
          </div>
        )}
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint={loading ? '正在整理...' : '你先说说最常发生的那一次就好'} disabled={loading} onSubmit={submit} />
    </AppShell>
  );
}

export default function FollowUpPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <FollowUpPageContent />
    </Suspense>
  );
}

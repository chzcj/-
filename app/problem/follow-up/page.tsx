'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useRef } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { QuestionCard } from '@/components/cards/QuestionCard';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { SecondaryButton } from '@/components/controls/Buttons';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingResult } from '@/components/states/LoadingResult';
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_MAX_ROUND } from '@/lib/conversation-config';
import { useConversationStore } from '@/store/useConversationStore';
import type { A1Output, ConversationStateData, InputMode } from '@/types/childos';

function FollowUpPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const roundParam = Number(params.get('round') || '2');
  const shouldStream = params.get('stream') === '1';
  const { hydrateState } = useConversationStore();
  const [state, setState] = useState<ConversationStateData | undefined>();
  const [a1, setA1] = useState<A1Output | undefined>();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(conversationId));
  const [error, setError] = useState('');
  const [streamText, setStreamText] = useState('');
  const [streamRound, setStreamRound] = useState<number | undefined>();
  const streamStartedRef = useRef(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!conversationId || shouldStream) return;
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
  }, [conversationId, hydrateState, shouldStream]);

  useEffect(() => {
    if (!conversationId || !shouldStream || streamStartedRef.current) return;
    streamStartedRef.current = true;
    const raw = window.sessionStorage.getItem(`childos_pending_answer_${conversationId}`);
    if (!raw) {
      setError('这次输入没有整理成功，可以再试一次。');
      setRestoring(false);
      return;
    }

    let cancelled = false;
    const pending = JSON.parse(raw) as { conversationId: string; round: number; inputMode: InputMode; text: string };
    setRestoring(false);
    setLoading(true);
    setStreamText('');
    setStreamRound(undefined);
    setError('');

    void apiClient.submitProblemAnswerStream(pending, {
      onStart: (nextRound) => {
        if (!cancelled) setStreamRound(nextRound);
      },
      onDelta: (delta) => {
        if (!cancelled) setStreamText((current) => `${current}${delta}`);
      },
      onFinal: (data) => {
        if (cancelled) return;
        window.sessionStorage.removeItem(`childos_pending_answer_${conversationId}`);
        setA1(data.a1);
        setLoading(false);
        submitLockRef.current = false;
        if (data.nextAction === 'confirm_generate_card' || data.nextAction === 'generate_draft_card') {
          router.push(`/problem/confirm?conversationId=${conversationId}`);
          return;
        }
        router.replace(`/problem/follow-up?conversationId=${conversationId}&round=${data.a1.progress.currentRound}`);
      },
      onError: (message) => {
        if (cancelled) return;
        setError(message);
        setLoading(false);
        submitLockRef.current = false;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId, router, shouldStream]);

  const currentA1 = useMemo(() => a1 || state?.latestA1, [a1, state]);
  const currentRound = currentA1?.progress.currentRound || roundParam;
  const maxRound = currentA1?.progress.maxRound || state?.maxRound || DEFAULT_MAX_ROUND;

  async function submit(text: string, inputMode: InputMode) {
    if (!conversationId || loading || submitLockRef.current) return;
    submitLockRef.current = true;
    setError('');
    const nextRound = currentRound + 1;
    window.sessionStorage.setItem(`childos_pending_answer_${conversationId}`, JSON.stringify({ conversationId, round: currentRound, inputMode, text }));
    streamStartedRef.current = false;
    setStreamText('');
    router.push(`/problem/follow-up?conversationId=${conversationId}&round=${nextRound}&stream=1`);
  }

  if (!conversationId || error || (!shouldStream && !restoring && !currentA1)) {
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
        <TopProgressBar progress={Math.min((currentRound / maxRound) * 100, 100)} status={`问题梳理中 · 第 ${currentRound} 轮`} onLeftClick={() => router.push('/home')} />
        {shouldStream ? (
          streamText ? (
            <div className="stack">
              <QuestionCard
                key="streaming-question"
                badge="只问一个关键点"
                question={streamText}
                hint="你先看这一句，后面会继续出来。"
                disabled
              />
            </div>
          ) : (
            <LoadingResult
              title={`正在整理第 ${streamRound || currentRound} 轮问题`}
              messages={['我在把你刚刚说的内容收成一个更关键的问题。']}
            />
          )
        ) : restoring || !currentA1 ? (
          <LoadingResult title="正在恢复这次整理" messages={['我在找回刚刚的上下文。']} />
        ) : (
          <div className="stack">
            <QuestionCard
              key={`question-${currentRound}`}
              badge="只问一个关键点"
              question={currentA1.highlightQuestion.text}
              hint={currentA1.highlightQuestion.inputHint}
              disabled={loading}
            />
            <div style={{ marginTop: 14 }}>
              <SecondaryButton onClick={() => router.push(`/problem/confirm?conversationId=${conversationId}`)} disabled={loading}>
                我觉得已经说完了，帮我整理
              </SecondaryButton>
            </div>
          </div>
        )}
      </div>
      <BottomVoiceBar state="idle" hint="你先说说最常发生的那一次就好" disabled={loading || shouldStream} onSubmit={submit} />
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

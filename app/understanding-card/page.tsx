'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { UnderstandingCard } from '@/components/cards/UnderstandingCard';
import { CardFeedbackPanel } from '@/components/feedback/CardFeedbackPanel';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import { VoiceOverlay } from '@/components/voice/VoiceOverlay';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';
import type { CardFeedbackType, UnderstandingCardData } from '@/types/childos';

const overlayCopy: Record<Exclude<CardFeedbackType, 'accurate'>, { title: string; description: string }> = {
  partially_inaccurate: { title: '说说哪里不太像', description: '不用重新讲全部，只说最不准确的那一点，我会帮你更新这张卡。' },
  edit: { title: '你想改哪一点', description: '可以直接告诉我：不是这样，更像是什么。' },
  add_detail: { title: '补充一个关键细节', description: '比如最近换老师、考试没考好，或不是所有数学都这样。' }
};

function UnderstandingCardPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const cardId = params.get('cardId') || undefined;
  const { understandingCard, setUnderstandingCard, setCardId } = useConversationStore();
  const [card, setCard] = useState<UnderstandingCardData | undefined>(understandingCard);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackType, setFeedbackType] = useState<Exclude<CardFeedbackType, 'accurate'> | undefined>();

  useEffect(() => {
    if (!conversationId) return;
    apiClient.getConversationState(conversationId).then((result) => {
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.data.understandingCard) {
        setCard(result.data.understandingCard);
        setUnderstandingCard(result.data.understandingCard);
        setCardId(result.data.understandingCard.cardId);
      }
    });
  }, [conversationId, setCardId, setUnderstandingCard]);

  async function accurate() {
    if (!conversationId || !card) return;
    setLoading(true);
    const result = await apiClient.submitUnderstandingFeedback({ conversationId, cardId: card.cardId, feedbackType: 'accurate' });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push(`/next-step?conversationId=${conversationId}&cardId=${card.cardId}`);
  }

  async function updateCard(text: string) {
    if (!conversationId || !card || !feedbackType) return;
    setLoading(true);
    const result = await apiClient.submitUnderstandingFeedback({ conversationId, cardId: card.cardId, feedbackType, text });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (result.data.card) {
      setCard(result.data.card);
      setUnderstandingCard(result.data.card);
      setCardId(result.data.cardId);
      router.replace(`/understanding-card?conversationId=${conversationId}&cardId=${result.data.cardId}`);
    }
    setFeedbackType(undefined);
  }

  if (!conversationId || error || !card) {
    return (
      <AppShell>
        <div className="page without-voice">
          <ErrorState title="理解卡没有恢复成功" description={error || '可以回到上一页重新生成。'} primaryLabel="回到首页" onPrimary={() => router.push('/home')} />
        </div>
      </AppShell>
    );
  }

  const copy = feedbackType ? overlayCopy[feedbackType] : undefined;

  return (
    <AppShell>
      <div className="page without-voice">
        <TopProgressBar title="孩子理解卡" showProgress={false} />
        <UnderstandingCard card={card} />
        <CardFeedbackPanel
          loading={loading}
          onAccurate={accurate}
          onPartiallyInaccurate={() => setFeedbackType('partially_inaccurate')}
          onEdit={() => setFeedbackType('edit')}
          onAddDetail={() => setFeedbackType('add_detail')}
        />
      </div>
      <VoiceOverlay open={Boolean(feedbackType)} title={copy?.title || ''} description={copy?.description || ''} loading={loading} onCancel={() => setFeedbackType(undefined)} onFinish={updateCard} />
    </AppShell>
  );
}

export default function UnderstandingCardPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <UnderstandingCardPageContent />
    </Suspense>
  );
}

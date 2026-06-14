'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useRef, useState } from 'react';
import { AdviceCard } from '@/components/cards/AdviceCard';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingResult } from '@/components/states/LoadingResult';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';
import type { AdviceCardData } from '@/types/childos';

function AdviceCardPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const cardId = params.get('cardId') || undefined;
  const { setAdviceCard, setArchiveDraft } = useConversationStore();
  const generatedRef = useRef(false);
  const [card, setCard] = useState<AdviceCardData | undefined>();
  const [error, setError] = useState('');
  const [loadingArchive, setLoadingArchive] = useState(false);

  useEffect(() => {
    if (!conversationId || !cardId) return;
    if (generatedRef.current) return;
    generatedRef.current = true;
    let mounted = true;
    const controller = new AbortController();
    apiClient.generateAdvice({ conversationId, cardId }, { signal: controller.signal }).then((response) => {
      if (!mounted) return;
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setCard(response.data.card);
      setAdviceCard(response.data.card);
    });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [cardId, conversationId, setAdviceCard]);

  async function archive() {
    if (!conversationId || !cardId || !card || loadingArchive) return;
    try {
      setLoadingArchive(true);
      const response = await apiClient.getArchiveDraft({ conversationId, cardId, adviceId: card.adviceId });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setArchiveDraft(response.data);
      router.push(`/archive/confirm?conversationId=${conversationId}&cardId=${cardId}&adviceId=${card.adviceId}`);
    } finally {
      setLoadingArchive(false);
    }
  }

  return (
    <AppShell>
      <div className="page without-voice">
        <TopProgressBar title="建议卡" showProgress={false} />
        {!conversationId || !cardId ? (
          <ErrorState title="建议卡没有顺利生成出来" description="可以回到首页重新开始。" primaryLabel="回到首页" onPrimary={() => router.push('/home')} />
        ) : error ? (
          <ErrorState title="建议卡没有顺利生成出来" description={error} primaryLabel="再试一次" onPrimary={() => window.location.reload()} />
        ) : !card ? (
          <LoadingResult title="正在生成建议卡" messages={['这次只给少量、贴合当前情况的小建议。', '我会避免泛泛地说多沟通、定规则。']} />
        ) : (
          <>
            <AdviceCard card={card} />
            <div className="button-row" style={{ marginTop: 14 }}>
              <SecondaryButton onClick={() => router.push(`/rehearsal/input?conversationId=${conversationId}&cardId=${cardId}`)}>说一说</SecondaryButton>
              <PrimaryButton loading={loadingArchive} onClick={archive}>
                我明白了，我去试试看
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function AdviceCardPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <AdviceCardPageContent />
    </Suspense>
  );
}

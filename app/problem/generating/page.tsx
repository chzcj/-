'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingResult } from '@/components/states/LoadingResult';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';

function GeneratingPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const conversationId = params.get('conversationId') || undefined;
  const { setUnderstandingCard } = useConversationStore();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!conversationId) return;
    apiClient.generateUnderstandingCard(conversationId).then((result) => {
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setUnderstandingCard(result.data.card);
      router.push(`/understanding-card?conversationId=${conversationId}&cardId=${result.data.cardId}`);
    });
  }, [conversationId, router, setUnderstandingCard]);

  return (
    <AppShell>
      <div className="page without-voice">
        <TopProgressBar progress={94} status="正在整理理解卡" />
        {error ? (
          <ErrorState title="这张理解卡没有顺利生成出来" description={error} primaryLabel="再试一次" secondaryLabel="返回上一页" onPrimary={() => window.location.reload()} onSecondary={() => router.back()} />
        ) : (
          <LoadingResult title="即将为你生成孩子理解卡" messages={['我在整理刚刚说到的真实场景。', '我会先看孩子可能卡住的地方。', '这不是诊断，只是阶段性理解。']} />
        )}
      </div>
    </AppShell>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <GeneratingPageContent />
    </Suspense>
  );
}

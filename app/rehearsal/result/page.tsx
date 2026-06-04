'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { RehearsalResultCard } from '@/components/cards/RehearsalResultCard';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';
import type { RehearsalResultData } from '@/types/childos';

function RehearsalResultPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const cardId = params.get('cardId') || undefined;
  const rehearsalId = params.get('rehearsalId') || undefined;
  const standalone = params.get('standalone') === '1';
  const { rehearsalResult, setArchiveDraft } = useConversationStore();
  const [result, setResult] = useState<RehearsalResultData | undefined>(rehearsalResult);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    apiClient.getConversationState(conversationId).then((response) => {
      if (response.ok) setResult(response.data.rehearsalResult);
      else setError(response.error.message);
    });
  }, [conversationId]);

  async function goArchive() {
    if (!conversationId || !cardId) return;
    setLoading(true);
    const response = await apiClient.getArchiveDraft({ conversationId, cardId, rehearsalId });
    setLoading(false);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setArchiveDraft(response.data);
    router.push(`/archive/confirm?conversationId=${conversationId}&cardId=${cardId}&rehearsalId=${rehearsalId || ''}`);
  }

  if (error || !result) {
    return (
      <AppShell>
        <div className="page without-voice">
          <ErrorState title="预演结果没有恢复成功" description={error || '可以回到上一页重新试说。'} primaryLabel="回到上一页" onPrimary={() => router.back()} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page without-voice">
        <TopProgressBar title="沟通预演" showProgress={false} />
        <RehearsalResultCard result={result} />
        <div className="button-row" style={{ marginTop: 14 }}>
          <SecondaryButton onClick={() => router.push(`/rehearsal/input?conversationId=${conversationId}&cardId=${cardId}&standalone=${standalone ? '1' : '0'}`)}>我想再换一句试试</SecondaryButton>
          <PrimaryButton loading={loading} onClick={goArchive}>
            这样就可以，进入孩子档案
          </PrimaryButton>
        </div>
      </div>
    </AppShell>
  );
}

export default function RehearsalResultPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <RehearsalResultPageContent />
    </Suspense>
  );
}

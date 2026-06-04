'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { RehearsalResultCard } from '@/components/cards/RehearsalResultCard';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingResult } from '@/components/states/LoadingResult';
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
  const [restoring, setRestoring] = useState(Boolean(conversationId) && !rehearsalResult);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    if (result) return;
    let mounted = true;
    const controller = new AbortController();
    setRestoring(true);
    apiClient.getConversationState(conversationId, { signal: controller.signal }).then((response) => {
      if (!mounted) return;
      if (response.ok) setResult(response.data.rehearsalResult);
      else setError(response.error.message);
      setRestoring(false);
    });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [conversationId]);

  async function goArchive() {
    if (!conversationId || !cardId || loading) return;
    try {
      setLoading(true);
      const response = await apiClient.getArchiveDraft({ conversationId, cardId, rehearsalId });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setArchiveDraft(response.data);
      router.push(`/archive/confirm?conversationId=${conversationId}&cardId=${cardId}&rehearsalId=${rehearsalId || ''}`);
    } finally {
      setLoading(false);
    }
  }

  if (!conversationId || error || (!restoring && !result)) {
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
        {restoring || !result ? <LoadingResult title="正在恢复预演结果" messages={['我在找回刚刚的分析。']} /> : <RehearsalResultCard result={result} />}
        <div className="button-row" style={{ marginTop: 14 }}>
          <SecondaryButton disabled={restoring || loading} onClick={() => router.push(`/rehearsal/input?conversationId=${conversationId}&cardId=${cardId}&standalone=${standalone ? '1' : '0'}`)}>我想再换一句试试</SecondaryButton>
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

'use client';

import { Archive, Lightbulb, MessagesSquare } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useState } from 'react';
import { EntryCard } from '@/components/cards/EntryCard';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';

function NextStepPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const cardId = params.get('cardId') || undefined;
  const { setArchiveDraft } = useConversationStore();
  const [loading, setLoading] = useState<'archive' | ''>('');
  const [toast, setToast] = useState('');

  async function archiveOnly() {
    if (!conversationId || !cardId) return;
    setLoading('archive');
    const result = await apiClient.getArchiveDraft({ conversationId, cardId });
    setLoading('');
    if (!result.ok) {
      setToast(result.error.message);
      return;
    }
    setArchiveDraft(result.data);
    router.push(`/archive/confirm?conversationId=${conversationId}&cardId=${cardId}`);
  }

  return (
    <AppShell>
      <div className="page without-voice">
        <TopProgressBar title="下一步" showProgress={false} />
        <h1 className="page-title">接下来你想怎么做？</h1>
        <p className="page-subtitle">基于这张孩子理解卡，你可以选择一个最适合现在的方向。</p>
        <div className="stack">
          <EntryCard icon={<MessagesSquare size={22} />} title="我想马上和孩子沟通" description="先试说一句，看看孩子可能怎么理解" onClick={() => router.push(`/rehearsal/input?conversationId=${conversationId}&cardId=${cardId}`)} />
          <EntryCard icon={<Lightbulb size={22} />} title="我想要一些建议" description="生成 1-2 个低成本、贴合本次情况的小建议" onClick={() => router.push(`/advice-card?conversationId=${conversationId}&cardId=${cardId}`)} />
          <EntryCard icon={<Archive size={22} />} title="我理解孩子的行为就够了" description="把今天的理解存入孩子档案" onClick={archiveOnly} loading={loading === 'archive'} />
        </div>
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </AppShell>
  );
}

export default function NextStepPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <NextStepPageContent />
    </Suspense>
  );
}

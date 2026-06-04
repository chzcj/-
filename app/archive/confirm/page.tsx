'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { ArchiveCard } from '@/components/cards/ArchiveCard';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { RawConversationDrawer } from '@/components/drawers/RawConversationDrawer';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';
import type { ArchiveDraft, ConversationRound } from '@/types/childos';

function ArchiveConfirmPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const cardId = params.get('cardId') || undefined;
  const { archiveDraft, setArchiveDraft } = useConversationStore();
  const [archive, setArchive] = useState<ArchiveDraft | undefined>(archiveDraft);
  const [rounds, setRounds] = useState<ConversationRound[]>([]);
  const [editable, setEditable] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!conversationId) return;
    apiClient.getConversationState(conversationId).then((stateResult) => {
      if (stateResult.ok) setRounds(stateResult.data.rounds);
    });
    if (!archive) {
      apiClient.getArchiveDraft({ conversationId, cardId }).then((result) => {
        if (result.ok) {
          setArchive(result.data);
          setArchiveDraft(result.data);
        } else setError(result.error.message);
      });
    }
  }, [archive, cardId, conversationId, setArchiveDraft]);

  async function confirm() {
    if (!conversationId || !archive) return;
    setLoading(true);
    const result = await apiClient.confirmArchive(conversationId, archive);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push(`/done?archiveId=${result.data.archiveId}`);
  }

  if (error || !archive) {
    return (
      <AppShell>
        <div className="page without-voice">
          <ErrorState title="档案草稿没有恢复成功" description={error || '可以回到上一页重新整理。'} primaryLabel="回到首页" onPrimary={() => router.push('/home')} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page without-voice">
        <TopProgressBar title="确认存入档案" showProgress={false} />
        <ArchiveCard
          archive={archive}
          editable={editable}
          onChange={(next) => {
            setArchive(next);
            setArchiveDraft(next);
          }}
        />
        <div className="button-row" style={{ marginTop: 14 }}>
          <SecondaryButton onClick={() => setDrawerOpen(true)}>查看原始聊天记录</SecondaryButton>
          <SecondaryButton onClick={() => setEditable((value) => !value)}>{editable ? '完成编辑' : '我要编辑'}</SecondaryButton>
        </div>
        <div style={{ marginTop: 12 }}>
          <PrimaryButton loading={loading} onClick={confirm}>
            确认存入档案
          </PrimaryButton>
        </div>
      </div>
      <RawConversationDrawer open={drawerOpen} rounds={rounds} onClose={() => setDrawerOpen(false)} />
    </AppShell>
  );
}

export default function ArchiveConfirmPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <ArchiveConfirmPageContent />
    </Suspense>
  );
}

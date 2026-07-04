'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';
import type { InputMode } from '@/types/childos';

interface RehearsalMessage {
  role: 'user' | 'assistant';
  text: string;
}

function RehearsalInputPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversationId') || undefined;
  const standalone = params.get('standalone') === '1';
  const { setConversationId } = useConversationStore();
  const [streamingText, setStreamingText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<RehearsalMessage[]>([]);
  const [toast, setToast] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  async function submit(text: string, _: InputMode) {
    if (loading || streaming) return;
    const value = text.trim();
    if (!value) return;

    try {
      setLoading(true);
      setStreaming(true);
      setStreamingText('');
      setToast('');

      let active = activeConversationId;
      if (!active) {
        const started = await apiClient.startConversation();
        if (!started.ok) {
          setToast(started.error.message);
          setLoading(false);
          setStreaming(false);
          return;
        }
        active = started.data.conversationId;
        setConversationId(active);
        setActiveConversationId(active);
      }

      setMessages((prev) => [...prev, { role: 'user', text: value }]);

      const lastMessages = [...messages, { role: 'user' as const, text: value }];
      let fullReply = '';

      await apiClient.submitRehearsalStream(
        { conversationId: active, text: value },
        {
          onDelta: (delta) => {
            fullReply += delta;
            setStreamingText(fullReply);
          },
          onFinal: (reply) => {
            setStreaming(false);
            setStreamingText('');
            setMessages(lastMessages.concat({ role: 'assistant', text: reply }));
          },
          onError: (message) => {
            setStreaming(false);
            setStreamingText('');
            setToast(message);
          }
        }
      );
    } catch {
      setStreaming(false);
      setToast('这次输入没有整理成功，可以再试一次。');
    } finally {
      setLoading(false);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <AppShell>
      <div className="page with-raised-voice">
        <TopProgressBar title="沟通预演" showProgress={false} onLeftClick={() => router.push('/home')} />
        {!hasMessages ? (
          <section className="question-card card">
            <div className="badge">开口前的理解对话</div>
            <div className="question-text">把你准备对孩子说的话发来，我们一起看看：这句话到了孩子那里，可能会被听成什么。</div>
            <div className="hint-text">{standalone ? '不用先改得好听，先把你原本想说的话发来。' : '只需要一句你最可能开口说的话。'}</div>
          </section>
        ) : (
          <div className="stack">
            {messages.map((msg, index) => (
              <div key={index} className={msg.role === 'user' ? 'rehearsal-user-bubble' : 'rehearsal-ai-bubble'}>
                <div className="section-body">{msg.text}</div>
              </div>
            ))}
            {streaming ? (
              <div className="rehearsal-ai-bubble">
                <div className="section-body">{streamingText || '...'}</div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        )}
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint={loading ? '正在整理…' : '按住说话，或点键盘输入'} disabled={loading} elevated onSubmit={submit} />
    </AppShell>
  );
}

export default function RehearsalInputPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="page without-voice" />
        </AppShell>
      }
    >
      <RehearsalInputPageContent />
    </Suspense>
  );
}

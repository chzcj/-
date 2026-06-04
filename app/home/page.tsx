'use client';

import { Archive, BookOpenText, Eye, MessageCircle, Mic, Shield, Square, Volume2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { apiClient } from '@/lib/api-client';
import { useConversationStore } from '@/store/useConversationStore';
import type { InputMode } from '@/types/childos';

export default function HomePage() {
  const router = useRouter();
  const { setConversationId, setCurrentRound } = useConversationStore();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [recording, setRecording] = useState(false);
  const [text, setText] = useState('');

  async function submit(textValue: string, inputMode: InputMode = 'text') {
    const value = textValue.trim();
    if (!value) {
      setToast('你可以先说一件最挂心的小事，或者在输入框里打字。');
      return;
    }
    setLoading(true);
    setToast('');
    const result = await apiClient.startConversation();
    if (!result.ok) {
      setLoading(false);
      setToast(result.error.message);
      return;
    }
    const answer = await apiClient.submitProblemAnswer({
      conversationId: result.data.conversationId,
      round: 1,
      inputMode,
      text: value
    });
    setLoading(false);
    if (!answer.ok) {
      setToast(answer.error.message);
      return;
    }
    setConversationId(result.data.conversationId);
    setCurrentRound(result.data.currentRound);
    router.push(`/problem/follow-up?conversationId=${result.data.conversationId}&round=${answer.data.a1.progress.currentRound}`);
  }

  return (
    <AppShell>
      <div className="talk-page">
        <div className="phone-status">
          <span>9:41</span>
          <span className="status-dots">•••</span>
        </div>

        <header className="talk-hero">
          <div className="app-mark">
            <Eye size={22} />
          </div>
          <div>
            <h1>心镜</h1>
            <p>给家长一面温柔的回声</p>
          </div>
        </header>

        <section className="privacy-pill" aria-label="语音提醒">
          <span className="privacy-icon">
            <Shield size={18} />
          </span>
          <span>语音提醒：聊天内容仅用于本次理解与陪伴，不会用于任何商业目的。</span>
          <button type="button" aria-label="播放提醒" onClick={() => setToast('当前为演示版：语音内容只用于本次理解与陪伴。')}>
            <Volume2 size={17} />
          </button>
        </section>

        <section className="talk-card">
          <div className="talk-card-top">
            <span><i />心镜语音捕捉</span>
            <span>00:00</span>
          </div>
          <div className="talk-question">可以从今天最让你挂心的一个瞬间说起。</div>
          <div className="audio-strip">
            <div className="bars" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, index) => (
                <span key={index} style={{ height: `${12 + ((index * 7) % 28)}px` }} />
              ))}
            </div>
            <span className="audio-count">1/1</span>
            <button
              className={`audio-play ${recording ? 'is-recording' : ''}`}
              type="button"
              onClick={() => {
                if (recording) {
                  setRecording(false);
                  void submit(text || '孩子最近写数学前总玩手机，一催就烦', 'voice');
                } else {
                  setRecording(true);
                  setToast('正在听你说，点击中间按钮可结束这一段。');
                }
              }}
              disabled={loading}
              aria-label={recording ? '结束录音' : '开始录音'}
            >
              {recording ? <Square size={20} /> : <Mic size={21} />}
            </button>
          </div>
        </section>

        <section className="emerging-card">
          <div>
            <span className="soft-dot" />
            <strong>家长画像正在浮现</strong>
          </div>
          <span>等待第一段描述</span>
        </section>

        <div className="record-area">
          <div className="record-time">{recording ? '00:04' : '00:00'}</div>
          <button
            className={`record-orb ${recording ? 'recording' : ''}`}
            type="button"
            disabled={loading}
            onClick={() => {
              if (recording) {
                setRecording(false);
                void submit(text || '孩子最近写数学前总玩手机，一催就烦', 'voice');
              } else {
                setRecording(true);
                setToast('正在听你说，点击可结束这一段。');
              }
            }}
          >
            <span>{recording ? <Square size={28} /> : <Mic size={28} />}</span>
          </button>
          <p>{loading ? '正在整理你的第一段描述...' : recording ? '正在听你说，点击可结束这一段' : '点击开始说，或在下方输入一句'}</p>
        </div>

        <div className="home-text-input">
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="例如：孩子最近写数学前总玩手机，一催就烦" />
          <button type="button" disabled={loading || !text.trim()} onClick={() => submit(text, 'text')}>
            发送
          </button>
        </div>

        {toast ? <div className="toast">{toast}</div> : null}
        <nav className="talk-tabs" aria-label="底部模块">
          <button type="button" className="active" onClick={() => setToast('你已经在对话入口，可以直接说一件挂心的小事。')}>
            <MessageCircle size={20} />
            <span>对话</span>
          </button>
          <button type="button" onClick={() => router.push('/rehearsal/input?standalone=1')}>
            <Mic size={20} />
            <span>沟通预演</span>
          </button>
          <button type="button" onClick={() => router.push('/record-child')}>
            <BookOpenText size={20} />
            <span>记录孩子</span>
          </button>
          <button type="button" onClick={() => router.push('/family-profile')}>
            <Archive size={20} />
            <span>档案</span>
          </button>
        </nav>
      </div>
    </AppShell>
  );
}

'use client';

import { Archive, BookOpenText, CalendarRange, ChevronRight, LayoutDashboard, LogOut, MessageCircle, Mic, Square, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput';
import { apiClient } from '@/lib/api-client';
import { formatBeijingTime, formatDuration } from '@/lib/beijing-time';
import { useConversationStore } from '@/store/useConversationStore';
import type { AuthUser, InputMode } from '@/types/childos';

export default function HomePage() {
  const router = useRouter();
  const { setConversationId, setCurrentRound } = useConversationStore();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordStartedAt, setRecordStartedAt] = useState<number | undefined>();
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [beijingTime, setBeijingTime] = useState('');
  const [text, setText] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const voice = useTencentAsrInput();
  const voiceText = voice.liveTranscript.trim();

  useEffect(() => {
    router.prefetch('/problem/start');
    router.prefetch('/rehearsal');
    router.prefetch('/record-child');
    router.prefetch('/family-planner');
    router.prefetch('/board');
    router.prefetch('/family-profile');
    router.prefetch('/login');
    apiClient.getMe().then((result) => {
      if (result.ok) setUser(result.data.user);
    });
  }, [router]);

  useEffect(() => {
    setBeijingTime(formatBeijingTime());
    const timer = window.setInterval(() => setBeijingTime(formatBeijingTime()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!recording || !recordStartedAt) {
      setRecordSeconds(0);
      return;
    }
    const tick = () => setRecordSeconds((Date.now() - recordStartedAt) / 1000);
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [recordStartedAt, recording]);

  useEffect(() => {
    if (recording && !voice.isListening) {
      setRecording(false);
      setRecordStartedAt(undefined);
    }
  }, [recording, voice.isListening]);

  async function logout() {
    const result = await apiClient.logout();
    if (result.ok) {
      setUser(null);
      setToast('已退出登录。');
    }
  }

  async function submit(textValue: string, inputMode: InputMode = 'text') {
    if (loading) return;
    const value = textValue.trim();
    if (!value) {
      setToast('你可以先说一件最挂心的小事，或者在输入框里打字。');
      return;
    }
    try {
      setLoading(true);
      setToast('');
      const result = await apiClient.startConversation();
      if (!result.ok) {
        setToast(result.error.message);
        return;
      }
      setConversationId(result.data.conversationId);
      setCurrentRound(result.data.currentRound);
      window.sessionStorage.setItem(
        `childos_pending_answer_${result.data.conversationId}`,
        JSON.stringify({ conversationId: result.data.conversationId, round: 1, inputMode, text: value })
      );
      router.push(`/problem/follow-up?conversationId=${result.data.conversationId}&round=2&stream=1`);
    } finally {
      setLoading(false);
    }
  }

  function startVoice() {
    if (loading) return;
    voice.startListening();
    setRecordStartedAt(Date.now());
    setRecordSeconds(0);
    setRecording(true);
    setToast('正在听你说，点击中间按钮可结束这一段。');
  }

  function finishVoice() {
    if (loading) return;
    const finalText = voice.stopListening() || voice.liveTranscript;
    setRecording(false);
    setRecordStartedAt(undefined);
    if (!finalText.trim()) {
      setToast(voice.error || '刚刚没有听清楚，可以再说一次，或在输入框里打字。');
      return;
    }
    setText(finalText.trim());
    void submit(finalText.trim(), 'voice');
    voice.reset();
  }

  return (
    <AppShell>
      <div className="talk-page home-page">
        <button
          className="auth-entry"
          type="button"
          onClick={() => {
            if (user) void logout();
            else router.push('/login');
          }}
        >
          {user ? <LogOut size={14} /> : <UserRound size={14} />}
          <span>{user ? `尾号 ${user.phone.slice(-4)}` : '登录'}</span>
        </button>

        <div className="phone-status">
          <span>{beijingTime}</span>
          <span className="status-dots">•••</span>
        </div>

        <div className="entry-card home-profile-entry" onClick={() => router.push('/profile/build')}>
          <div className="icon-box">
            <UserRound size={22} />
          </div>
          <span className="home-profile-copy">
            <span className="entry-title">建立孩子画像</span>
            <span className="entry-desc">先认识孩子，再判断怎么支持</span>
          </span>
          <span className="entry-action">
            去建立
            <ChevronRight size={16} style={{ marginLeft: 4 }} />
          </span>
        </div>

        <button
          type="button"
          onClick={() => router.push('/board')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', marginBottom: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 18, cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(110,106,248,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6E6AF8', flexShrink: 0 }}>
            <LayoutDashboard size={20} />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#1D1D1F' }}>家庭支持看板</span>
            <span style={{ display: 'block', fontSize: 13, color: '#6E6E73', marginTop: 2 }}>当前状态、稳定理解、下一步</span>
          </span>
          <ChevronRight size={18} style={{ color: '#C7C7CC', flexShrink: 0 }} />
        </button>

        <section className="talk-card">
          <div className="talk-card-top">
            <span><i />心镜语音捕捉</span>
            <span>00:00</span>
          </div>
          <div className="talk-question">{voiceText || '可以从今天最让你挂心的一个瞬间说起。'}</div>
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
              onClick={recording ? finishVoice : startVoice}
              disabled={loading}
              aria-label={recording ? '结束录音' : '开始录音'}
            >
              {recording ? <Square size={20} /> : <Mic size={21} />}
            </button>
          </div>
        </section>

        <div className="record-area">
          <div className="record-time">{formatDuration(recording ? recordSeconds : 0)}</div>
          <button
            className={`record-orb ${recording ? 'recording' : ''}`}
            type="button"
            disabled={loading}
            onClick={recording ? finishVoice : startVoice}
          >
            <span>{recording ? <Square size={28} /> : <Mic size={28} />}</span>
          </button>
          <p>{loading ? '正在整理你的第一段描述...' : recording ? '正在听你说，点击可结束这一段' : voice.error || '点击开始说，或在下方输入一句'}</p>
        </div>

        <div className="home-text-input">
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="例如：孩子最近写数学前总玩手机，一催就烦" disabled={loading} />
          <button type="button" disabled={loading || !text.trim()} onClick={() => submit(text, 'text')}>
            发送
          </button>
        </div>

        {toast ? <div className="toast">{toast}</div> : null}
        <nav className="talk-tabs" aria-label="底部模块">
          <button type="button" className="active" onClick={() => setToast('你已经在对话页，可以直接说一件挂心的小事。')}>
            <MessageCircle size={20} />
            <span>对话</span>
          </button>
          <button type="button" onClick={() => router.push('/rehearsal')}>
            <Mic size={20} />
            <span>沟通预演</span>
          </button>
          <button type="button" onClick={() => router.push('/record-child')}>
            <BookOpenText size={20} />
            <span>记录孩子</span>
          </button>
          <button type="button" onClick={() => router.push('/family-planner')}>
            <CalendarRange size={20} />
            <span>家庭规划</span>
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

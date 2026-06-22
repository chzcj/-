'use client';

import { CalendarRange, ChevronRight, FileText, GraduationCap, LayoutDashboard, LogOut, Mic, Settings, Square, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BottomNavTabs } from '@/components/layout/BottomNavTabs';
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput';
import { apiClient } from '@/lib/api-client';
import { formatBeijingTime, formatDuration } from '@/lib/beijing-time';
import { useConversationStore } from '@/store/useConversationStore';
import { hasProfile, hydrateProfileFromRemote } from '@/lib/storage/profileStorage';
import { clearAllChildOSData } from '@/lib/storage/localStorageService';
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
  const [hasBuiltProfile, setHasBuiltProfile] = useState(false);
  const voice = useTencentAsrInput();
  const voiceText = voice.liveTranscript.trim();

  useEffect(() => {
    router.prefetch('/problem/start');
    router.prefetch('/daily');
    router.prefetch('/rehearsal');
    router.prefetch('/record-child');
    router.prefetch('/family-planner');
    router.prefetch('/education-diagnosis');
    router.prefetch('/material-understanding');
    router.prefetch('/board');
    router.prefetch('/family-profile');
    router.prefetch('/login');
    apiClient.getMe().then((result) => {
      if (result.ok) setUser(result.data.user);
    });
  }, [router]);

  // 跨设备/重装：本机有画像直接用；本机无则从 DB 取并回灌 localStorage（之后全应用 hasProfile 生效）。
  useEffect(() => {
    if (hasProfile()) { setHasBuiltProfile(true); return; }
    let cancelled = false;
    fetch('/api/profile/built')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok && json.data?.snapshot?.coreJudgment) {
          hydrateProfileFromRemote(json.data.snapshot);
          setHasBuiltProfile(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
      clearAllChildOSData(); // 清本地画像/记忆缓存，防同浏览器切账号串数据
      setUser(null);
      setHasBuiltProfile(false);
      router.replace('/login');
    }
  }

  async function submit(textValue: string, inputMode: InputMode = 'text') {
    if (loading) return;
    const value = textValue.trim();
    if (!value) {
      setToast('你可以先说一件最挂心的小事，或者在输入框里打字。');
      return;
    }
    // 主入口进入新版日常对话（合并深度复盘，交付文档 4）：首条输入暂存后跳转 /daily 流式开聊。
    // sessionStorage 在隐私/无痕模式可能抛异常，兜底——即使存不进也照常跳转（daily 进空态，不阻断）。
    try {
      window.sessionStorage.setItem('childos_daily_pending', JSON.stringify({ text: value, inputMode }));
    } catch {}
    router.push('/daily');
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

        <div
          className="entry-card home-profile-entry"
          role="button"
          tabIndex={0}
          aria-label={hasBuiltProfile ? '孩子画像，查看条件化画像与支持重点' : '建立孩子画像'}
          onClick={() => router.push(hasBuiltProfile ? '/profile/result' : '/profile/build')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(hasBuiltProfile ? '/profile/result' : '/profile/build'); } }}
        >
          <div className="icon-box">
            <UserRound size={22} />
          </div>
          <span className="home-profile-copy">
            <span className="entry-title">{hasBuiltProfile ? '孩子画像' : '建立孩子画像'}</span>
            <span className="entry-desc">{hasBuiltProfile ? '查看孩子的条件化画像与支持重点' : '先认识孩子，再判断怎么支持'}</span>
          </span>
          <span className="entry-action">
            {hasBuiltProfile ? '去查看' : '去建立'}
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

        {user?.isAdmin && (
          <button
            type="button"
            onClick={() => router.push('/admin')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', marginBottom: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 18, cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(110,106,248,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6E6AF8', flexShrink: 0 }}>
              <Settings size={20} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#1D1D1F' }}>管理员后台</span>
              <span style={{ display: 'block', fontSize: 13, color: '#6E6E73', marginTop: 2 }}>系统状态、数据统计、AI 配置</span>
            </span>
            <ChevronRight size={18} style={{ color: '#C7C7CC', flexShrink: 0 }} />
          </button>
        )}

        {/* 四个并列专项功能（交付文档 5.3 + 2 材料理解，2×2）：按需进入专项采集 / 轻追问 */}
        <div className="feature-trio feature-quad">
          <button type="button" onClick={() => router.push('/rehearsal')}>
            <span className="ft-icon"><Mic size={18} /></span>
            <span className="ft-name">沟通预演</span>
            <span className="ft-desc">想好怎么说，先预演一遍</span>
          </button>
          <button type="button" onClick={() => router.push('/education-diagnosis')}>
            <span className="ft-icon"><GraduationCap size={18} /></span>
            <span className="ft-name">教育模式诊断</span>
            <span className="ft-desc">看清这个家每天怎么运转</span>
          </button>
          <button type="button" onClick={() => router.push('/family-planner')}>
            <span className="ft-icon"><CalendarRange size={18} /></span>
            <span className="ft-name">家庭规划</span>
            <span className="ft-desc">按家庭承受力定下一步</span>
          </button>
          <button type="button" onClick={() => router.push('/material-understanding')}>
            <span className="ft-icon"><FileText size={18} /></span>
            <span className="ft-name">材料理解</span>
            <span className="ft-desc">把材料里的事实和评价分开看</span>
          </button>
        </div>

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
        <BottomNavTabs active="home" />
      </div>
    </AppShell>
  );
}

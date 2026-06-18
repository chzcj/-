'use client';

import { Archive, CheckCircle2, Home, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { VoiceFieldButton, appendTranscript } from '@/components/voice/VoiceFieldButton';
import { apiClient } from '@/lib/api-client';

export default function RecordChildPage() {
  const router = useRouter();
  const [eventText, setEventText] = useState('');
  const [changeText, setChangeText] = useState('');
  const [worryText, setWorryText] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  async function save() {
    if (saving) return;
    if (!eventText.trim() && !changeText.trim() && !worryText.trim()) {
      setToast('先写下一件小事、一个变化，或一个你想继续观察的点。');
      return;
    }
    setSaving(true);
    const result = await apiClient.recordChild({ eventText, changeText, worryText });
    if (result.ok) {
      setSaved(true);
      setToast('已保存为本地演示记录。接入真实数据库后，这里会写入孩子档案。');
    } else {
      setToast(result.error.message);
    }
    setSaving(false);
  }

  return (
    <AppShell>
      <div className="page without-voice">
        <TopProgressBar title="记录孩子" showProgress={false} />
        <section className="module-hero-card">
          <div className="module-kicker">
            <Sparkles size={16} />
            成长记录
          </div>
          <h1>把今天值得记住的一件小事留下来。</h1>
          <p>这里不做判断，只帮你把变化、担心和后续观察点沉淀下来。每个输入都能直接说。</p>
        </section>

        <div className="stack">
          <label className="record-field">
            <span>今天发生了什么</span>
            <textarea value={eventText} onChange={(event) => setEventText(event.target.value)} placeholder="例如：今天孩子主动说了学校里一件事，虽然很短，但比前几天愿意开口。" disabled={saving} />
            <VoiceFieldButton compact disabled={saving} onTranscript={(t) => setEventText((prev) => appendTranscript(prev, t))} />
          </label>
          <label className="record-field">
            <span>你看到的一个变化</span>
            <textarea value={changeText} onChange={(event) => setChangeText(event.target.value)} placeholder="例如：写数学前还是有点拖，但今天没有马上顶嘴。" disabled={saving} />
            <VoiceFieldButton compact disabled={saving} onTranscript={(t) => setChangeText((prev) => appendTranscript(prev, t))} />
          </label>
          <label className="record-field">
            <span>后面想继续观察什么</span>
            <textarea value={worryText} onChange={(event) => setWorryText(event.target.value)} placeholder="例如：继续观察他是卡在开始前，还是卡在某一道题之后。" disabled={saving} />
            <VoiceFieldButton compact disabled={saving} onTranscript={(t) => setWorryText((prev) => appendTranscript(prev, t))} />
          </label>
        </div>

        {saved ? (
          <section className="saved-card">
            <CheckCircle2 size={20} />
            <div>
              <strong>记录已收到</strong>
              <p>这条会进入长期记忆，参与对孩子的持续理解；后续在看板和画像里会用到。</p>
            </div>
          </section>
        ) : null}

        {toast ? <div className="toast">{toast}</div> : null}

        <div style={{ marginTop: 14 }}>
          <PrimaryButton onClick={save} loading={saving}>保存记录</PrimaryButton>
        </div>
        <div className="button-row" style={{ marginTop: 10 }}>
          <SecondaryButton onClick={() => router.push('/home')}>
            <Home size={16} />
            回到对话
          </SecondaryButton>
          <SecondaryButton onClick={() => router.push('/family-profile')}>
            <Archive size={16} />
            查看档案
          </SecondaryButton>
        </div>
      </div>
    </AppShell>
  );
}

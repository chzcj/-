'use client';

import { Archive, CheckCircle2, Home, Mic, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';

export default function RecordChildPage() {
  const router = useRouter();
  const [eventText, setEventText] = useState('');
  const [changeText, setChangeText] = useState('');
  const [worryText, setWorryText] = useState('');
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');

  function save() {
    if (!eventText.trim() && !changeText.trim() && !worryText.trim()) {
      setToast('先写下一件小事、一个变化，或一个你想继续观察的点。');
      return;
    }
    setSaved(true);
    setToast('已保存为本地演示记录。接入真实数据库后，这里会写入孩子档案。');
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
          <p>这里不做判断，只帮你把变化、担心和后续观察点沉淀下来。</p>
        </section>

        <div className="stack">
          <label className="record-field">
            <span>今天发生了什么</span>
            <textarea value={eventText} onChange={(event) => setEventText(event.target.value)} placeholder="例如：今天孩子主动说了学校里一件事，虽然很短，但比前几天愿意开口。" />
          </label>
          <label className="record-field">
            <span>你看到的一个变化</span>
            <textarea value={changeText} onChange={(event) => setChangeText(event.target.value)} placeholder="例如：写数学前还是有点拖，但今天没有马上顶嘴。" />
          </label>
          <label className="record-field">
            <span>后面想继续观察什么</span>
            <textarea value={worryText} onChange={(event) => setWorryText(event.target.value)} placeholder="例如：继续观察他是卡在开始前，还是卡在某一道题之后。" />
          </label>
        </div>

        {saved ? (
          <section className="saved-card">
            <CheckCircle2 size={20} />
            <div>
              <strong>记录已暂存</strong>
              <p>当前是 MVP 演示版，真实数据库接入后会写入长期档案。</p>
            </div>
          </section>
        ) : null}

        {toast ? <div className="toast">{toast}</div> : null}

        <div className="button-row" style={{ marginTop: 14 }}>
          <SecondaryButton onClick={() => setToast('语音记录会在接入真实 ASR 后开放；现在可以先打字记录。')}>
            <Mic size={16} />
            语音记录
          </SecondaryButton>
          <PrimaryButton onClick={save}>保存记录</PrimaryButton>
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

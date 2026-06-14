'use client';

import { Archive, BookOpenText, CalendarDays, ChevronRight, Home, MessageCircle, Mic, RefreshCw, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EntryCard } from '@/components/cards/EntryCard';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { apiClient } from '@/lib/api-client';
import type { ProfileSnapshotCardLink } from '@/types/childos';

const recentItems = [
  {
    title: '数学作业开始前更容易拖延',
    body: '当前更像是启动压力，而不是单纯贪玩手机。'
  },
  {
    title: '催促后容易进入防御',
    body: '家长一提醒，孩子可能先听成“不被信任”。'
  }
];

export default function FamilyProfilePage() {
  const router = useRouter();
  const [toast, setToast] = useState('');
  const [activePanel, setActivePanel] = useState<'recent' | 'stable' | 'observe' | 'weekly' | undefined>();
  const [items, setItems] = useState(recentItems);
  const [currentFocus, setCurrentFocus] = useState('先别急着围绕“手机”制定规则，优先观察孩子到底卡在开始前，还是卡在某一道题之后。');
  const [latestUnderstandingCard, setLatestUnderstandingCard] = useState<ProfileSnapshotCardLink | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyData, setWeeklyData] = useState<{
    sessionCount: number;
    recentClues: Array<{ type: string; title: string; content: string; createdAt?: string }>;
    childEvents: Array<{ title: string; eventText: string; createdAt?: string }>;
    weeklySummary: string;
  } | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState(false);

  useEffect(() => {
    refreshProfile(false);
  }, []);

  async function refreshProfile(showToast = true) {
    if (refreshing) return;
    setRefreshing(true);
    const result = await apiClient.getProfileSnapshot();
    if (result.ok) {
      if (result.data.recentChanges?.length) setItems(result.data.recentChanges);
      if (result.data.currentFocus) setCurrentFocus(result.data.currentFocus);
      setLatestUnderstandingCard(result.data.latestUnderstandingCard);
      if (showToast) setToast('已刷新演示看板。真实数据库接入后会重新拉取最新档案。');
    } else if (showToast) {
      setToast(result.error.message);
    }
    setRefreshing(false);
  }

  async function openWeeklyReview() {
    if (activePanel === 'weekly') {
      setActivePanel(undefined);
      return;
    }
    setLoadingWeekly(true);
    setActivePanel('weekly');
    const result = await apiClient.getWeeklyReview();
    if (result.ok) {
      setWeeklyData(result.data);
    } else {
      setWeeklyData({ sessionCount: 0, recentClues: [], childEvents: [], weeklySummary: '本周回顾暂时加载失败，可以稍后再试。' });
    }
    setLoadingWeekly(false);
  }

  return (
    <AppShell>
      <div className="page without-voice">
        <TopProgressBar title="孩子档案" showProgress={false} />

        <section className="module-hero-card">
          <div className="module-kicker">
            <Archive size={16} />
            家庭支持看板
          </div>
          <h1>最近我们先关注一件事。</h1>
          <p>把已确认的线索、待观察点和支持方向放在这里，避免每次都从头说起。</p>
        </section>

        <section className="profile-summary-grid">
          <button type="button" className={activePanel === 'recent' ? 'active' : ''} onClick={() => setActivePanel(activePanel === 'recent' ? undefined : 'recent')}>
            <strong>{items.length}</strong>
            <span>近期线索</span>
          </button>
          <button type="button" className={activePanel === 'stable' ? 'active' : ''} onClick={() => setActivePanel(activePanel === 'stable' ? undefined : 'stable')}>
            <strong>0</strong>
            <span>稳定画像</span>
          </button>
          <button type="button" className={activePanel === 'observe' ? 'active' : ''} onClick={() => setActivePanel(activePanel === 'observe' ? undefined : 'observe')}>
            <strong>{currentFocus ? 1 : 0}</strong>
            <span>观察重点</span>
          </button>
        </section>

        {activePanel ? (
          <section className="profile-panel card">
            {activePanel === 'recent' ? (
              <>
                <div className="result-title">近期线索</div>
                {items.map((item) => (
                  <div className="profile-panel-item" key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                ))}
              </>
            ) : null}
            {activePanel === 'stable' ? (
              <>
                <div className="result-title">稳定画像</div>
                <div className="section-body">当前还没有稳定画像。单次事件只会作为待验证线索，不会直接定义孩子。</div>
              </>
            ) : null}
            {activePanel === 'observe' ? (
              <>
                <div className="result-title">观察重点</div>
                <div className="section-body">{currentFocus}</div>
              </>
            ) : null}
            {activePanel === 'weekly' ? (
              <>
                <div className="result-title">本周回顾</div>
                {loadingWeekly ? (
                  <div className="section-body" style={{ color: 'var(--text-tertiary)' }}>正在加载本周数据...</div>
                ) : weeklyData ? (
                  <>
                    <div className="section-body" style={{ marginBottom: 14 }}>{weeklyData.weeklySummary}</div>
                    {weeklyData.recentClues.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        <div className="section-title">本周线索</div>
                        {weeklyData.recentClues.slice(0, 6).map((clue, index) => (
                          <div className="profile-panel-item" key={`${clue.type}-${index}`}>
                            <strong>{clue.title}</strong>
                            <p>{clue.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {weeklyData.childEvents.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        <div className="section-title">孩子记录</div>
                        {weeklyData.childEvents.map((event, index) => (
                          <div className="profile-panel-item" key={`event-${index}`}>
                            <strong>{event.title}</strong>
                            <p>{event.eventText}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        <div className="stack">
          {latestUnderstandingCard ? (
            <section className="result-card card">
              <div className="result-title">最近理解卡</div>
              <button
                className="profile-row"
                type="button"
                onClick={() =>
                  router.push(
                    `/understanding-card?conversationId=${latestUnderstandingCard.conversationId}&cardId=${latestUnderstandingCard.cardId}`
                  )
                }
              >
                <span>
                  <strong>{latestUnderstandingCard.title}</strong>
                  <small>{latestUnderstandingCard.preview || `版本 ${latestUnderstandingCard.version}`}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            </section>
          ) : null}

          <section className="result-card card">
            <div className="result-title">近期变化</div>
            {items.map((item) => (
              <button className="profile-row" type="button" key={item.title} onClick={() => setToast(item.body)}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </section>

          <section className="result-card card">
            <div className="result-title">当前支持重点</div>
            <div className="section-body">{currentFocus}</div>
            <div className="button-row" style={{ marginTop: 14 }}>
              <SecondaryButton onClick={() => router.push('/rehearsal/input?standalone=1')}>
                <Mic size={16} />
                试一句沟通
              </SecondaryButton>
              <SecondaryButton onClick={() => router.push('/record-child')}>
                <BookOpenText size={16} />
                补一条记录
              </SecondaryButton>
            </div>
          </section>

          <EntryCard icon={<CalendarDays size={22} />} title="本周回顾" description="查看这周出现过的亲子互动线索" onClick={openWeeklyReview} />
          <EntryCard icon={<ShieldCheck size={22} />} title="隐私与授权" description="查看哪些内容会被存入长期档案" onClick={() => setToast('当前演示版只保存 mock 数据；真实上线前会补隐私授权页。')} />
        </div>

        {toast ? <div className="toast">{toast}</div> : null}

        <div className="button-row" style={{ marginTop: 14 }}>
          <PrimaryButton onClick={() => router.push('/home')}>
            <MessageCircle size={16} />
            继续对话
          </PrimaryButton>
          <SecondaryButton loading={refreshing} onClick={() => refreshProfile(true)}>
            <RefreshCw size={16} />
            刷新
          </SecondaryButton>
        </div>
        <div style={{ marginTop: 10 }}>
          <SecondaryButton onClick={() => router.push('/home')}>
            <Home size={16} />
            回到首页
          </SecondaryButton>
        </div>
      </div>
    </AppShell>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DailyBubbleShell } from '@/components/daily/DailyBubbleShell';
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell';
import { OnboardingGuard } from '@/components/layout/OnboardingGuard';
import { ErrorState } from '@/components/states/ErrorState';
import { VoiceOverlay } from '@/components/voice/VoiceOverlay';
import { readDailyDeepSections } from '@/lib/daily/dailyThreadUtils';

function DailyDeepExpandView() {
  const router = useRouter();
  const [{ sections, prose, traceId }, setPayload] = useState(() => readDailyDeepSections());
  const [feedback, setFeedback] = useState<'accurate' | 'partial' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [partialOverlayOpen, setPartialOverlayOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setPayload(readDailyDeepSections());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // 进入深度展开 = 家长觉得这轮值得深挖 → 通知后端沉淀 episode（含六维深拆）。
  // 幂等：同 traceId 用 sessionStorage 标记，重复进入不重复入队。
  useEffect(() => {
    if (!traceId) return;
    const firedKey = `childos_deep_expand_fired_${traceId}`;
    if (sessionStorage.getItem(firedKey)) return;
    sessionStorage.setItem(firedKey, '1');
    void fetch('/api/daily/deep-expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traceId }),
    }).catch(() => {
      /* 沉淀失败不影响阅读，静默 */
    });
  }, [traceId]);

  async function postFeedback(kind: 'accurate' | 'partial', note?: string) {
    const sectionIds = sections.map((s) => s.id);
    if (!traceId) {
      try {
        sessionStorage.setItem(
          'childos_daily_deep_feedback',
          JSON.stringify({ kind, traceId: '', saved: false, note: note || '', at: Date.now() })
        );
      } catch {
        /* ignore */
      }
      setToast('已记录在本机；回到交流再生成一轮后可同步到服务器。');
      return false;
    }

    try {
      const res = await fetch('/api/daily/section-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId, kind, sectionIds, note: note?.trim() || undefined }),
      });
      const json = (await res.json()) as { ok?: boolean };
      const saved = Boolean(json.ok);
      try {
        sessionStorage.setItem(
          'childos_daily_deep_feedback',
          JSON.stringify({ kind, traceId, saved, note: note || '', at: Date.now() })
        );
      } catch {
        /* ignore */
      }
      if (saved) {
        setToast(
          kind === 'accurate'
            ? '收到了，我会更按这个方向理解。'
            : note?.trim()
              ? '收到了，这条校正会进入记忆。'
              : '收到了，已记下不太像。'
        );
      } else {
        setToast('反馈已记下；若未同步成功，可回到交流页再试一次。');
      }
      return saved;
    } catch {
      setToast('反馈已记下；若未同步成功，可回到交流页再试一次。');
      return false;
    }
  }

  async function submitAccurate() {
    if (submitting || feedback) return;
    setSubmitting(true);
    setFeedback('accurate');
    await postFeedback('accurate');
    setSubmitting(false);
  }

  function openPartialOverlay() {
    if (submitting || feedback) return;
    setPartialOverlayOpen(true);
  }

  async function submitPartialNote(note: string) {
    if (submitting) return;
    setSubmitting(true);
    setPartialOverlayOpen(false);
    setFeedback('partial');
    await postFeedback('partial', note);
    setSubmitting(false);
  }

  if (!sections.length) {
    return (
      <OnboardingGuard>
        <HiFiMainShell activeTab="chat" showInput={false}>
          <button type="button" className="quiet-button" onClick={() => router.push('/daily')}>
            <ArrowLeft size={16} /> 返回交流
          </button>
          <ErrorState
            title="暂时没有可展开的内容"
            description="请先在交流页生成一轮回复，再点「查看深度展开」。"
            primaryLabel="回到交流"
            onPrimary={() => router.push('/daily')}
          />
        </HiFiMainShell>
      </OnboardingGuard>
    );
  }

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="chat" showInput={false}>
        <button type="button" className="quiet-button" onClick={() => router.push('/daily')}>
          <ArrowLeft size={16} /> 返回交流
        </button>

        <article className="hero-card compact">
          <span className="module-kicker">理解卡</span>
          <h2 className="hero-title">深度展开</h2>
          <p className="hero-copy">下面是结合已有材料，对刚才那轮交流的展开说明。</p>
        </article>

        <div className="chat-feed">
          <DailyBubbleShell prose={prose} sections={sections} animateSections={false} />
        </div>

        <div className="suggestion-strip" style={{ marginTop: 12 }}>
          <button
            type="button"
            className={`pill${feedback === 'accurate' ? ' primary' : ''}`}
            disabled={submitting || feedback !== null}
            onClick={() => void submitAccurate()}
          >
            这段像我家情况
          </button>
          <button
            type="button"
            className={`pill${feedback === 'partial' ? ' primary' : ''}`}
            disabled={submitting || feedback !== null}
            onClick={openPartialOverlay}
          >
            哪里不太像
          </button>
        </div>
        {toast ? <div className="toast">{toast}</div> : null}
        <VoiceOverlay
          open={partialOverlayOpen}
          title="说说哪里不太像"
          description="可以补充一句哪里不准；也可以直接点「先记不太像」。"
          allowEmpty
          emptyFinishLabel="先记不太像"
          finishLabel="提交校正"
          loading={submitting}
          onCancel={() => !submitting && setPartialOverlayOpen(false)}
          onFinish={(text) => void submitPartialNote(text)}
        />
      </HiFiMainShell>
    </OnboardingGuard>
  );
}

function UnderstandingCardPageContent() {
  const source = useSearchParams().get('source');
  if (source !== 'daily') {
    return (
      <OnboardingGuard>
        <HiFiMainShell activeTab="chat" showInput={false}>
          <ErrorState
            title="这个入口已下线"
            description="请从交流页进入深度展开。"
            primaryLabel="回到交流"
            onPrimary={() => window.location.assign('/daily')}
          />
        </HiFiMainShell>
      </OnboardingGuard>
    );
  }
  return <DailyDeepExpandView />;
}

export default function UnderstandingCardPage() {
  return (
    <Suspense fallback={null}>
      <UnderstandingCardPageContent />
    </Suspense>
  );
}

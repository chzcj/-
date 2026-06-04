'use client';

import { useEffect, useState } from 'react';
import type { ConversationRound } from '@/types/childos';
import { SecondaryButton } from '@/components/controls/Buttons';

interface RawConversationDrawerProps {
  open: boolean;
  rounds: ConversationRound[];
  onClose: () => void;
}

export function RawConversationDrawer({ open, rounds, onClose }: RawConversationDrawerProps) {
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    const timer = window.setTimeout(() => setRendered(false), 210);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!rendered) return null;
  return (
    <>
      <div className={`overlay drawer-overlay ${open ? 'is-open' : 'is-closing'}`} onClick={onClose} />
      <div className={`drawer ${open ? 'is-open' : 'is-closing'}`}>
        <div className="result-title">原始聊天摘要</div>
        <p className="section-body">默认先展示摘要，避免把情绪化长文本直接堆在主页面。</p>
        {rounds.length ? rounds.map((round) => (
          <details className="round-item" key={`${round.round}-${round.summary}`}>
            <summary className="section-title">第 {round.round} 轮：{round.summary.replace(/^第 \d+ 轮：/, '')}</summary>
            <div className="section-body" style={{ marginTop: 8 }}>
              {round.rawText}
            </div>
          </details>
        )) : <div className="section-body empty-state">暂无原始聊天摘要。</div>}
        <div style={{ marginTop: 14 }}>
          <SecondaryButton onClick={onClose}>关闭</SecondaryButton>
        </div>
      </div>
    </>
  );
}

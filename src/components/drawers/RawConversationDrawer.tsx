'use client';

import type { ConversationRound } from '@/types/childos';
import { SecondaryButton } from '@/components/controls/Buttons';

interface RawConversationDrawerProps {
  open: boolean;
  rounds: ConversationRound[];
  onClose: () => void;
}

export function RawConversationDrawer({ open, rounds, onClose }: RawConversationDrawerProps) {
  if (!open) return null;
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div className="result-title">原始聊天摘要</div>
        <p className="section-body">默认先展示摘要，避免把情绪化长文本直接堆在主页面。</p>
        {rounds.map((round) => (
          <details className="round-item" key={`${round.round}-${round.summary}`}>
            <summary className="section-title">第 {round.round} 轮：{round.summary.replace(/^第 \d+ 轮：/, '')}</summary>
            <div className="section-body" style={{ marginTop: 8 }}>
              {round.rawText}
            </div>
          </details>
        ))}
        <div style={{ marginTop: 14 }}>
          <SecondaryButton onClick={onClose}>关闭</SecondaryButton>
        </div>
      </div>
    </>
  );
}

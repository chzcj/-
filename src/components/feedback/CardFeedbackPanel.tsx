'use client';

import { Mic } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';

interface CardFeedbackPanelProps {
  loading?: boolean;
  onAccurate: () => void;
  onPartiallyInaccurate: () => void;
  onEdit: () => void;
  onAddDetail: () => void;
}

export function CardFeedbackPanel({ loading, onAccurate, onPartiallyInaccurate, onEdit, onAddDetail }: CardFeedbackPanelProps) {
  return (
    <div className="feedback-panel">
      <div className="feedback-title">你觉得这张卡怎么样？</div>
      <div className="stack">
        <PrimaryButton loading={loading} onClick={onAccurate}>
          很像我家孩子
        </PrimaryButton>
        <SecondaryButton onClick={onPartiallyInaccurate} disabled={loading}>
          有一部分不太像 <Mic size={14} />
        </SecondaryButton>
        <SecondaryButton onClick={onEdit} disabled={loading}>
          我想改一下 <Mic size={14} />
        </SecondaryButton>
        <SecondaryButton onClick={onAddDetail} disabled={loading}>
          我想补充一个细节 <Mic size={14} />
        </SecondaryButton>
      </div>
    </div>
  );
}

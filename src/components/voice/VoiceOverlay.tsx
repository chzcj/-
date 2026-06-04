'use client';

import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';

interface VoiceOverlayProps {
  open: boolean;
  title: string;
  description: string;
  loading?: boolean;
  onCancel: () => void;
  onFinish: (text: string) => void;
}

export function VoiceOverlay({ open, title, description, loading, onCancel, onFinish }: VoiceOverlayProps) {
  const [text, setText] = useState('');
  if (!open) return null;

  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="result-title">{title}</div>
        <p className="section-body" style={{ marginTop: 0 }}>
          {description}
        </p>
        <textarea className="text-field" value={text} onChange={(event) => setText(event.target.value)} placeholder="这里先用文字模拟语音修正，后续可接入真实录音。" />
        <div className="button-row" style={{ marginTop: 12 }}>
          <SecondaryButton onClick={onCancel} disabled={loading}>
            取消
          </SecondaryButton>
          <PrimaryButton onClick={() => onFinish(text.trim())} disabled={!text.trim()} loading={loading}>
            结束并更新
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

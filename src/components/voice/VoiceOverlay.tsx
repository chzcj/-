'use client';

import { Mic, Square } from 'lucide-react';
import { useState } from 'react';
import { useEffect } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput';

interface VoiceOverlayProps {
  open: boolean;
  title: string;
  description: string;
  loading?: boolean;
  allowEmpty?: boolean;
  emptyFinishLabel?: string;
  finishLabel?: string;
  onCancel: () => void;
  onFinish: (text: string) => void;
}

export function VoiceOverlay({
  open,
  title,
  description,
  loading,
  allowEmpty = false,
  emptyFinishLabel = '先记不太像',
  finishLabel = '结束并更新',
  onCancel,
  onFinish,
}: VoiceOverlayProps) {
  const [text, setText] = useState('');
  const [rendered, setRendered] = useState(open);
  const voice = useTencentAsrInput();

  useEffect(() => {
    if (open) {
      setRendered(true);
      setText('');
      return;
    }
    const timer = window.setTimeout(() => setRendered(false), 210);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (voice.liveTranscript) setText(voice.liveTranscript);
  }, [voice.liveTranscript]);

  function toggleVoice() {
    if (loading) return;
    if (voice.isListening) {
      const finalText = voice.stopListening();
      if (finalText) setText(finalText);
      return;
    }
    voice.startListening();
  }

  if (!rendered) return null;

  const canFinish = allowEmpty || Boolean(text.trim());
  const primaryLabel = text.trim() ? finishLabel : emptyFinishLabel;

  return (
    <div className={`overlay ${open ? 'is-open' : 'is-closing'}`}>
      <div className="overlay-card">
        <div className="result-title">{title}</div>
        <p className="section-body" style={{ marginTop: 0 }}>{description}</p>
        <textarea className="text-field" value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'可以直接说修正内容，也可以打字。'}
          disabled={loading} />
        {voice.error ? <div className="toast">{voice.error}</div> : null}
        <div className="button-row" style={{ marginTop: 12 }}>
          <SecondaryButton onClick={toggleVoice} disabled={loading}>
            {voice.isListening ? <Square size={16} /> : <Mic size={16} />}
            {voice.isListening ? '结束录音' : '语音输入'}
          </SecondaryButton>
          <SecondaryButton onClick={onCancel} disabled={loading}>取消</SecondaryButton>
          <PrimaryButton onClick={() => !loading && canFinish && onFinish(text.trim())}
            disabled={!canFinish || loading} loading={loading}>{primaryLabel}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

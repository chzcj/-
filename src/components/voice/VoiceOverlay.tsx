'use client';

import { Mic, Square } from 'lucide-react';
import { useState } from 'react';
import { useEffect } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { useVoiceInput } from '@/hooks/useVoiceInput';

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
  const [rendered, setRendered] = useState(open);
  const voice = useVoiceInput();

  useEffect(() => {
    if (open) {
      setRendered(true);
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

  return (
    <div className={`overlay ${open ? 'is-open' : 'is-closing'}`}>
      <div className="overlay-card">
        <div className="result-title">{title}</div>
        <p className="section-body" style={{ marginTop: 0 }}>
          {description}
        </p>
        <textarea className="text-field" value={text} onChange={(event) => setText(event.target.value)} placeholder={voice.isSupported ? '可以直接说修正内容，也可以打字。' : '当前浏览器暂不支持语音识别，可以先打字。'} disabled={loading} />
        {voice.error ? <div className="toast">{voice.error}</div> : null}
        <div className="button-row" style={{ marginTop: 12 }}>
          <SecondaryButton onClick={toggleVoice} disabled={loading || !voice.isSupported}>
            {voice.isListening ? <Square size={16} /> : <Mic size={16} />}
            {voice.isListening ? '结束录音' : '语音输入'}
          </SecondaryButton>
          <SecondaryButton onClick={onCancel} disabled={loading}>
            取消
          </SecondaryButton>
          <PrimaryButton onClick={() => !loading && onFinish(text.trim())} disabled={!text.trim() || loading} loading={loading}>
            结束并更新
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

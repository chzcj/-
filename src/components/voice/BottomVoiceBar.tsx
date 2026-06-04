'use client';

import { Keyboard, Mic, Square } from 'lucide-react';
import { useState } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import type { VoiceState } from '@/types/childos';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';

interface BottomVoiceBarProps {
  state?: VoiceState;
  hint: string;
  disabled?: boolean;
  onSubmit: (text: string, mode: 'voice' | 'text') => void;
}

export function BottomVoiceBar({ state = 'idle', hint, disabled, onSubmit }: BottomVoiceBarProps) {
  const voice = useVoiceInput();
  const [keyboardOpen, setKeyboardOpen] = useState(!voice.isSupported);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const displayState: VoiceState = failed ? 'failed' : voice.isListening ? 'recording' : state;
  const liveTranscript = [voice.transcript, voice.interimTranscript].filter(Boolean).join('');

  const finishVoice = () => {
    voice.stopListening();
    const finalText = liveTranscript.trim();
    if (!finalText) {
      setFailed(true);
      setKeyboardOpen(true);
      return;
    }
    setFailed(false);
    onSubmit(finalText, 'voice');
    voice.reset();
  };

  return (
    <div className="voice-bar">
      <div className="voice-hint">
        {!voice.isSupported ? '当前浏览器暂不支持语音输入，可以先打字' : displayState === 'failed' ? '刚刚没有完全听清，可以再说一次' : hint}
      </div>
      <div className="voice-actions">
        <button className="icon-button" type="button" onClick={() => setKeyboardOpen((open) => !open)} aria-label="切换文字输入">
          <Keyboard size={18} />
        </button>
        <button
          className={`mic-button ${displayState === 'recording' ? 'recording' : ''}`}
          type="button"
          disabled={disabled || !voice.isSupported}
          onClick={voice.isListening ? finishVoice : voice.startListening}
          aria-label={voice.isListening ? '结束录音' : '开始录音'}
        >
          {voice.isListening ? <Square size={22} /> : <Mic size={26} />}
        </button>
        <span />
      </div>
      {liveTranscript ? <div className="toast">{liveTranscript}</div> : null}
      {keyboardOpen ? (
        <div className="text-input-panel">
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="也可以直接打字，把最真实的情况说出来。" />
          <div className="button-row">
            <SecondaryButton onClick={() => setText('')} disabled={!text.trim()}>
              清空
            </SecondaryButton>
            <PrimaryButton
              onClick={() => {
                const value = text.trim();
                if (!value) return;
                onSubmit(value, 'text');
                setText('');
              }}
              disabled={!text.trim() || disabled}
            >
              说完了
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

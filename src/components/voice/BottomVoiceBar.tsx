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
  const liveTranscript = voice.liveTranscript;

  const finishVoice = () => {
    if (disabled) return;
    const finalText = voice.stopListening() || liveTranscript.trim();
    if (!finalText) {
      setFailed(true);
      setKeyboardOpen(true);
      return;
    }
    setFailed(false);
    setKeyboardOpen(false);
    onSubmit(finalText, 'voice');
    voice.reset();
  };

  const submitText = () => {
    if (disabled) return;
    const value = text.trim();
    if (!value) return;
    setText('');
    setKeyboardOpen(false);
    onSubmit(value, 'text');
  };

  return (
    <div className="voice-bar">
      <div className="voice-hint">
        {!voice.isSupported ? '当前浏览器暂不支持语音输入，可以先打字' : displayState === 'failed' ? '刚刚没有完全听清，可以再说一次' : hint}
      </div>
      <div className="voice-actions">
        <button className="icon-button" type="button" onClick={() => setKeyboardOpen((open) => !open)} disabled={disabled} aria-label="切换文字输入">
          <Keyboard size={18} />
        </button>
        <button
          className={`mic-button ${displayState === 'recording' ? 'recording' : ''}`}
          type="button"
          disabled={disabled || !voice.isSupported}
          onClick={voice.isListening ? finishVoice : disabled ? undefined : voice.startListening}
          aria-label={voice.isListening ? '结束录音' : '开始录音'}
        >
          {voice.isListening ? <Square size={22} /> : <Mic size={26} />}
        </button>
        <span />
      </div>
      {voice.error ? <div className="toast">{voice.error}</div> : liveTranscript ? <div className="toast">{liveTranscript}</div> : null}
      <div className={`text-input-panel ${keyboardOpen ? 'open' : ''}`} aria-hidden={!keyboardOpen}>
        <div className="text-input-panel-inner">
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="也可以直接打字，把最真实的情况说出来。" disabled={disabled} />
          <div className="button-row">
            <SecondaryButton onClick={() => setText('')} disabled={!text.trim()}>
              清空
            </SecondaryButton>
            <PrimaryButton onClick={submitText} disabled={!text.trim() || disabled}>
              说完了
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

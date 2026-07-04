'use client';

import { Keyboard, Mic, Square } from 'lucide-react';
import { useState } from 'react';
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput';
import type { VoiceState } from '@/types/childos';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';

interface BottomVoiceBarProps {
  state?: VoiceState;
  hint: string;
  placeholder?: string;
  disabled?: boolean;
  elevated?: boolean;
  onSubmit: (text: string, mode: 'voice' | 'text') => void;
}

export function BottomVoiceBar({ state = 'idle', hint, placeholder, disabled, elevated = false, onSubmit }: BottomVoiceBarProps) {
  const voice = useTencentAsrInput();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
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
    <div className={`voice-bar ${elevated ? 'elevated' : ''}`}>
      <div className="voice-hint">
        {displayState === 'failed' ? '刚刚没有听清，可以直接打字或再说一次' : hint}
      </div>
      <div className="voice-dock-main">
        <button
          className="voice-dock-side-button"
          type="button"
          onClick={() => setKeyboardOpen((open) => !open)}
          disabled={disabled}
          aria-label="切换文字输入"
        >
          <Keyboard size={18} />
        </button>
        <button
          className={`mic-button voice-dock-mic ${displayState === 'recording' ? 'recording' : ''}`}
          type="button"
          disabled={disabled}
          onClick={voice.isListening ? finishVoice : disabled ? undefined : voice.startListening}
          aria-label={voice.isListening ? '结束录音' : '开始录音'}
        >
          {voice.isListening ? <Square size={22} /> : <Mic size={26} />}
        </button>
        <div className="voice-dock-side-button ghost" aria-hidden="true" />
      </div>
      {voice.error ? <div className="voice-dock-status">{voice.error}</div> : null}
      {!voice.error && liveTranscript ? <div className="voice-dock-status">{liveTranscript}</div> : null}
      <div className={`text-input-panel ${keyboardOpen ? 'open' : ''}`}>
        {keyboardOpen ? (
          <div className="text-input-panel-inner">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitText();
                }
              }}
              placeholder={placeholder || '也可以直接打字，把最真实的情况说出来。'}
              disabled={disabled}
            />
            <div className="voice-dock-submit-row">
              <SecondaryButton onClick={() => setText('')} disabled={!text.trim()} aria-label="清空文字输入">
                清空
              </SecondaryButton>
              <PrimaryButton onClick={submitText} disabled={!text.trim() || disabled} aria-label="发送文字输入">
                发送
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

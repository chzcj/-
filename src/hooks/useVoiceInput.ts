'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const interimRef = useRef('');

  useEffect(() => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setIsSupported(false);
      setError('语音输入需要 HTTPS 环境，可以先用文字输入。');
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setIsSupported(false);
      setError('当前浏览器暂不支持语音识别，可以先打字。');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText) {
        setTranscript((current) => {
          const next = `${current}${finalText}`.trim();
          transcriptRef.current = next;
          return next;
        });
      }
      interimRef.current = interimText;
      setInterimTranscript(interimText);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      setIsListening(false);
      setError(mapSpeechError(event.error));
    };
    recognitionRef.current = recognition;
  }, []);

  return useMemo(
    () => ({
      transcript,
      interimTranscript,
      liveTranscript: [transcript, interimTranscript].filter(Boolean).join(''),
      isListening,
      isSupported,
      error,
      startListening: () => {
        if (!recognitionRef.current || isListening) return false;
        setError('');
        setTranscript('');
        setInterimTranscript('');
        transcriptRef.current = '';
        interimRef.current = '';
        setIsListening(true);
        try {
          recognitionRef.current.start();
          return true;
        } catch {
          setIsListening(false);
          setError('语音没有成功开始，可以再点一次，或先用文字输入。');
          return false;
        }
      },
      stopListening: () => {
        recognitionRef.current?.stop();
        setIsListening(false);
        return [transcriptRef.current, interimRef.current].filter(Boolean).join('').trim();
      },
      getTranscript: () => [transcriptRef.current, interimRef.current].filter(Boolean).join('').trim(),
      reset: () => {
        setTranscript('');
        setInterimTranscript('');
        transcriptRef.current = '';
        interimRef.current = '';
        setError('');
      }
    }),
    [error, interimTranscript, isListening, isSupported, transcript]
  );
}

function mapSpeechError(error?: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') return '麦克风权限没有打开，可以允许权限后再试。';
  if (error === 'no-speech') return '刚刚没有听到清楚的声音，可以再说一次。';
  if (error === 'audio-capture') return '没有检测到可用麦克风，可以检查设备权限。';
  if (error === 'network') return '语音识别网络暂时不稳定，可以再试一次。';
  return '语音识别暂时不可用，可以先打字。';
}

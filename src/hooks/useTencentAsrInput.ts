'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const TARGET_SAMPLE_RATE = 16000;

export function useTencentAsrInput() {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptRef = useRef('');
  const interimRef = useRef('');

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  function cleanup() {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }

  async function startListening() {
    setError('');
    setIsListening(true);

    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setError('语音转文字需要 HTTPS 安全连接，可以先打字输入。');
      setIsListening(false);
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setIsSupported(false);
        setError('当前浏览器暂不支持麦克风采集，可以先打字输入。');
        setIsListening(false);
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '/api/asr/stream';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: { ideal: 1 },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          streamRef.current = stream;

          const audioCtx = new AudioContext();
          audioCtxRef.current = audioCtx;
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }

          const source = audioCtx.createMediaStreamSource(stream);

          const bufferSize = 3200;
          const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (event) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const inputData = event.inputBuffer.getChannelData(0);
            const downsampled = downsampleBuffer(inputData, audioCtx.sampleRate, TARGET_SAMPLE_RATE);
            const pcm = new Int16Array(downsampled.length);
            for (let i = 0; i < downsampled.length; i++) {
              const s = Math.max(-1, Math.min(1, downsampled[i]));
              pcm[i] = s < 0 ? s * 32768 : s * 32767;
            }
            ws.send(pcm.buffer);
          };

          source.connect(processor);
          processor.connect(audioCtx.destination);
        } catch (err: unknown) {
          const msg = mapMicrophoneError(err);
          setError(msg);
          setIsListening(false);
          ws.close();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.code !== 0) {
            if (msg.code === 111) return;
            throw new Error(msg.message || '识别出错');
          }
          const result = msg.result;
          if (!result?.voice_text_str) return;

          const text = result.voice_text_str;
          if (result.slice_type === 2) {
            setTranscript((current) => {
              const next = current + text;
              transcriptRef.current = next;
              return next;
            });
            interimRef.current = '';
            setInterimTranscript('');
          } else {
            interimRef.current = text;
            setInterimTranscript(text);
          }
        } catch {
          setError('语音识别暂时不可用，可以先打字。');
          setIsListening(false);
          cleanup();
        }
      };

      ws.onerror = () => {
        setError('语音识别服务暂时不可用，可以再试一次。');
        setIsListening(false);
        cleanup();
      };

      ws.onclose = () => {
        setIsListening(false);
        cleanup();
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '语音服务初始化失败。';
      setError(msg);
      setIsListening(false);
      cleanup();
    }
  }

  function stopListening() {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanup();
    const finalTranscript = transcriptRef.current.trim();
    setIsListening(false);
    return finalTranscript;
  }

  function getTranscript() {
    return transcriptRef.current.trim();
  }

  function reset() {
    setTranscript('');
    setInterimTranscript('');
    setError('');
    transcriptRef.current = '';
    interimRef.current = '';
  }

  return useMemo(
    () => ({
      transcript,
      interimTranscript,
      liveTranscript: [transcript, interimTranscript].filter(Boolean).join(''),
      isListening,
      isSupported,
      error,
      startListening,
      stopListening,
      getTranscript,
      reset,
    }),
    [error, interimTranscript, isListening, isSupported, transcript],
  );
}

function downsampleBuffer(buffer: Float32Array, inputRate: number, targetRate: number) {
  if (!Number.isFinite(inputRate) || inputRate <= 0 || inputRate === targetRate) {
    return buffer;
  }

  const ratio = inputRate / targetRate;
  const newLength = Math.max(1, Math.round(buffer.length / ratio));
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.min(buffer.length, Math.round((offsetResult + 1) * ratio));
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer; i += 1) {
      accum += buffer[i];
      count += 1;
    }

    result[offsetResult] = count > 0 ? accum / count : buffer[Math.min(offsetBuffer, buffer.length - 1)] ?? 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function mapMicrophoneError(err: unknown) {
  if (!(err instanceof DOMException)) {
    return '麦克风初始化失败。';
  }

  switch (err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '麦克风权限没有打开，可以允许权限后再试。';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '没有检测到可用麦克风，可以检查系统输入设备。';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return '麦克风当前被系统或其他应用占用，先关闭占用后再试。';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return '当前浏览器的麦克风参数不兼容，已建议切到更兼容模式后重试。';
    default:
      return `麦克风初始化失败（${err.name}）。`;
  }
}

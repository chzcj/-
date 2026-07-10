import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { ensureRecordPermission } from '@/lib/asrPermission'
import { apiRequest } from '@/services/api'

function isSocketTask(value: unknown): value is Taro.SocketTask {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Taro.SocketTask).onOpen === 'function'
  )
}

async function connectAsrSocket(url: string): Promise<Taro.SocketTask | null> {
  try {
    const pending = Taro.connectSocket({ url })
    const task =
      pending && typeof (pending as Promise<Taro.SocketTask>).then === 'function'
        ? await pending
        : (pending as unknown as Taro.SocketTask)
    return isSocketTask(task) ? task : null
  } catch {
    return null
  }
}

type AsrMessage = {
  code?: number
  message?: string
  result?: {
    slice_type?: number
    voice_text_str?: string
  }
}

function mapAsrError(code: string | undefined, fallback: string): string {
  if (code === 'ASR_UNCONFIGURED') {
    return '语音服务未配置，可以先打字输入。（服务端需配置 TENCENT_APPID / SECRET）'
  }
  return fallback
}

export function useTencentAsrInput() {
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState('')
  const [serviceUnavailable, setServiceUnavailable] = useState(false)
  const socketRef = useRef<Taro.SocketTask | null>(null)
  const transcriptRef = useRef('')
  const interimRef = useRef('')
  const recorderBoundRef = useRef(false)

  const liveTranscript = transcript + interimTranscript
  const asrUnavailable =
    serviceUnavailable || /不可用|未配置|socket 合法域名/.test(error)

  useEffect(() => {
    return () => cleanup()
  }, [])

  function safeCloseSocket() {
    const socket = socketRef.current
    socketRef.current = null
    if (socket && typeof socket.close === 'function') {
      try {
        socket.close({})
      } catch {
        /* ignore */
      }
    }
  }

  function stopRecorder() {
    try {
      Taro.getRecorderManager().stop()
    } catch {
      /* ignore */
    }
  }

  function cleanup() {
    stopRecorder()
    safeCloseSocket()
    setIsListening(false)
  }

  function reset() {
    setTranscript('')
    setInterimTranscript('')
    transcriptRef.current = ''
    interimRef.current = ''
    setError('')
  }

  function bindRecorder(socket: Taro.SocketTask) {
    const recorder = Taro.getRecorderManager()
    if (!recorderBoundRef.current) {
      recorderBoundRef.current = true
      recorder.onFrameRecorded((res) => {
        if (socketRef.current && res.frameBuffer) {
          socketRef.current.send({ data: res.frameBuffer })
        }
      })
      recorder.onStop(() => setIsListening(false))
      recorder.onError((err) => {
        const msg =
          err?.errMsg?.includes('auth')
            ? '录音失败，请检查麦克风权限。'
            : '录音失败，可以先打字输入。'
        setError(msg)
        setIsListening(false)
        safeCloseSocket()
      })
    }
    recorder.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      format: 'PCM',
      frameSize: 4,
    })
    setIsListening(true)
  }

  function handleAsrPayload(raw: string) {
    let data: AsrMessage | null = null
    try {
      data = JSON.parse(raw) as AsrMessage
    } catch {
      return
    }
    if (!data) return

    if (typeof data.code === 'number' && data.code !== 0) {
      if (data.code === 111) return
      setError(data.message || '语音识别暂时不可用，可以先打字。')
      cleanup()
      return
    }

    const result = data.result
    if (!result?.voice_text_str) return
    const text = String(result.voice_text_str)
    if (!text) return

    if (result.slice_type === 2) {
      transcriptRef.current += text
      interimRef.current = ''
      setTranscript(transcriptRef.current)
      setInterimTranscript('')
    } else {
      interimRef.current = text
      setInterimTranscript(text)
    }
  }

  async function startListening() {
    setError('')

    const perm = await ensureRecordPermission()
    if (!perm.ok) {
      setError(perm.message)
      return
    }

    cleanup()

    const tokenRes = await apiRequest<{ wsUrl: string }>('/api/asr/token', { method: 'GET' })
    if (!tokenRes.ok) {
      const isUnconfigured = tokenRes.error.code === 'ASR_UNCONFIGURED'
      if (isUnconfigured) setServiceUnavailable(true)
      setError(
        mapAsrError(
          tokenRes.error.code,
          tokenRes.error.message || '语音暂时不可用，可以先打字输入。'
        )
      )
      return
    }

    const socket = await connectAsrSocket(tokenRes.data.wsUrl)
    if (!socket) {
      setServiceUnavailable(true)
      setError(
        '语音连接失败。真机需在公众平台添加 socket 合法域名 wss://asr.cloud.tencent.com；开发期可勾选「不校验合法域名」。'
      )
      return
    }

    socketRef.current = socket

    socket.onOpen(() => {
      bindRecorder(socket)
    })

    socket.onMessage((msg) => {
      const raw = typeof msg.data === 'string' ? msg.data : ''
      if (raw) handleAsrPayload(raw)
    })

    socket.onError(() => {
      setServiceUnavailable(true)
      setError('语音连接失败，可以先打字输入。')
      cleanup()
    })

    socket.onClose(() => {
      if (socketRef.current === socket) {
        socketRef.current = null
      }
      setIsListening(false)
    })
  }

  function stopListening(): string {
    stopRecorder()
    safeCloseSocket()
    const finalText = (transcriptRef.current + interimRef.current).trim()
    setTranscript(finalText)
    setInterimTranscript('')
    transcriptRef.current = finalText
    interimRef.current = ''
    setIsListening(false)
    return finalText
  }

  return {
    transcript,
    interimTranscript,
    liveTranscript,
    isListening,
    isSupported: true,
    error,
    asrUnavailable,
    startListening,
    stopListening,
    getTranscript: () => (transcriptRef.current + interimRef.current).trim(),
    reset,
  }
}

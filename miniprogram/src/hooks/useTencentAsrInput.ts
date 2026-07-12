import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { ensureRecordPermission } from '@/lib/asrPermission'
import { apiRequest } from '@/services/api'

const FRAME_BUFFER_MAX = 64
const END_WAIT_MS = 2000
const END_WAIT_FAST_MS = 450
const MIN_HOLD_MS = 100
const SILENT_WARN_MS = 1200

function isSocketTask(value: unknown): value is Taro.SocketTask {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Taro.SocketTask).onOpen === 'function'
  )
}

export function isDevToolsSimulator(): boolean {
  try {
    return Taro.getSystemInfoSync().platform === 'devtools'
  } catch {
    return false
  }
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
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [serviceUnavailable, setServiceUnavailable] = useState(false)
  const socketRef = useRef<Taro.SocketTask | null>(null)
  const socketOpenedRef = useRef(false)
  const transcriptRef = useRef('')
  const interimRef = useRef('')
  const recorderBoundRef = useRef(false)
  const frameBufferRef = useRef<ArrayBuffer[]>([])
  const framesSentRef = useRef(0)
  const endSentRef = useRef(false)
  const finalWaitResolveRef = useRef<(() => void) | null>(null)
  const silentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionGenRef = useRef(0)

  const simulatorUnsupported = isDevToolsSimulator()
  const liveTranscript = transcript + interimTranscript
  /** 仅服务端不可用时禁用；模拟器只做 banner，不把真机误伤为 unavailable */
  const asrUnavailable = serviceUnavailable

  useEffect(() => {
    return () => cleanup()
  }, [])

  function clearSilentTimer() {
    if (silentTimerRef.current) {
      clearTimeout(silentTimerRef.current)
      silentTimerRef.current = null
    }
  }

  function resolveFinalWait() {
    finalWaitResolveRef.current?.()
    finalWaitResolveRef.current = null
  }

  function safeCloseSocket() {
    const socket = socketRef.current
    const opened = socketOpenedRef.current
    socketRef.current = null
    socketOpenedRef.current = false
    if (!opened || !socket || typeof socket.close !== 'function') return
    try {
      socket.close({ success: () => undefined, fail: () => undefined })
    } catch {
      /* ignore */
    }
  }

  function stopRecorder() {
    try {
      Taro.getRecorderManager().stop()
    } catch {
      /* ignore */
    }
  }

  function flushFrameBuffer() {
    const socket = socketRef.current
    if (!socket || !socketOpenedRef.current) return
    const queue = frameBufferRef.current
    frameBufferRef.current = []
    for (const buf of queue) {
      try {
        socket.send({ data: buf })
        framesSentRef.current += 1
      } catch {
        /* ignore */
      }
    }
  }

  function pushFrame(frameBuffer: ArrayBuffer) {
    if (socketRef.current && socketOpenedRef.current) {
      try {
        socketRef.current.send({ data: frameBuffer })
        framesSentRef.current += 1
      } catch {
        /* ignore */
      }
      return
    }
    const buf = frameBufferRef.current
    if (buf.length >= FRAME_BUFFER_MAX) buf.shift()
    buf.push(frameBuffer)
  }

  function cleanup() {
    sessionGenRef.current += 1
    clearSilentTimer()
    resolveFinalWait()
    stopRecorder()
    safeCloseSocket()
    frameBufferRef.current = []
    framesSentRef.current = 0
    endSentRef.current = false
    setIsListening(false)
    setIsConnecting(false)
  }

  function reset() {
    cleanup()
    setTranscript('')
    setInterimTranscript('')
    transcriptRef.current = ''
    interimRef.current = ''
    setError('')
  }

  function clearError() {
    setError('')
  }

  function ensureRecorderBound() {
    if (recorderBoundRef.current) return
    recorderBoundRef.current = true
    const recorder = Taro.getRecorderManager()
    recorder.onFrameRecorded((res) => {
      if (res.frameBuffer) pushFrame(res.frameBuffer)
    })
    recorder.onStop(() => {
      if (!endSentRef.current) setIsListening(false)
    })
    recorder.onError((err) => {
      const msg = err?.errMsg?.includes('auth')
        ? '录音失败，请检查麦克风权限。'
        : '录音失败，可以先打字输入。'
      setError(msg)
      cleanup()
    })
  }

  function startEarlyRecorder() {
    ensureRecorderBound()
    try {
      Taro.getRecorderManager().start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        format: 'PCM',
        frameSize: 4,
      })
      setIsListening(true)
    } catch {
      setError('无法启动录音，可以先打字输入。')
      cleanup()
    }
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
      const rawMsg = data.message || ''
      const friendly = /15秒|未发送音频|4004|资源包/.test(rawMsg)
        ? '语音未收到有效录音，请重新按住说话，或点「文」改用文字。'
        : rawMsg || '语音识别暂时不可用，可以先打字。'
      setError(friendly)
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
      if (endSentRef.current) resolveFinalWait()
    } else {
      interimRef.current = text
      setInterimTranscript(text)
    }
  }

  function waitForFinalResults(maxMs = END_WAIT_MS): Promise<void> {
    if (!socketRef.current || !socketOpenedRef.current) return Promise.resolve()
    return new Promise((resolve) => {
      finalWaitResolveRef.current = resolve
      setTimeout(() => resolveFinalWait(), maxMs)
    })
  }

  async function startListening() {
    setError('')
    setServiceUnavailable(false)
    // 立刻进入 connecting，不等待隐私/权限 await，否则真机按住长时间零反馈
    setIsConnecting(true)

    if (simulatorUnsupported) {
      setIsConnecting(false)
      setError('模拟器不支持语音验收，请用真机预览按住说话。')
      return
    }

    const perm = await ensureRecordPermission()
    if (!perm.ok) {
      setIsConnecting(false)
      setError(perm.message)
      return
    }

    cleanup()
    const gen = sessionGenRef.current
    setIsConnecting(true)
    transcriptRef.current = ''
    interimRef.current = ''
    setTranscript('')
    setInterimTranscript('')

    startEarlyRecorder()

    clearSilentTimer()
    silentTimerRef.current = setTimeout(() => {
      if (sessionGenRef.current !== gen) return
      if (framesSentRef.current === 0 && frameBufferRef.current.length === 0) {
        setError('未检测到声音，请靠近麦克风说话，或点「文」改用文字。')
      }
    }, SILENT_WARN_MS)

    const tokenRes = await apiRequest<{ wsUrl: string }>('/api/asr/token', { method: 'GET' })
    if (sessionGenRef.current !== gen) return

    if (!tokenRes.ok) {
      const isUnconfigured = tokenRes.error.code === 'ASR_UNCONFIGURED'
      if (isUnconfigured) setServiceUnavailable(true)
      setError(
        mapAsrError(
          tokenRes.error.code,
          tokenRes.error.message || '语音暂时不可用，可以先打字输入。'
        )
      )
      cleanup()
      return
    }

    const socket = await connectAsrSocket(tokenRes.data.wsUrl)
    if (sessionGenRef.current !== gen) return

    if (!socket) {
      setError(
        '语音连接失败。真机需在公众平台添加 socket 合法域名 wss://asr.cloud.tencent.com；开发期可勾选「不校验合法域名」。'
      )
      cleanup()
      return
    }

    socketRef.current = socket
    socketOpenedRef.current = false

    socket.onOpen(() => {
      if (sessionGenRef.current !== gen) return
      socketOpenedRef.current = true
      setIsConnecting(false)
      flushFrameBuffer()
    })

    socket.onMessage((msg) => {
      const raw = typeof msg.data === 'string' ? msg.data : ''
      if (raw) handleAsrPayload(raw)
    })

    socket.onError(() => {
      if (sessionGenRef.current !== gen) return
      setError(
        '语音连接失败。开发工具请关闭「校验合法域名」，或在公众平台添加 socket 域名 wss://asr.cloud.tencent.com。'
      )
      cleanup()
    })

    socket.onClose(() => {
      if (socketRef.current === socket) socketRef.current = null
      socketOpenedRef.current = false
      if (sessionGenRef.current === gen) {
        setIsConnecting(false)
        if (!endSentRef.current) setIsListening(false)
      }
    })
  }

  type StopListeningOptions = {
    /** 松手即返回当前转写，不阻塞 UI；final slice 在后台补齐 */
    fast?: boolean
    onRefined?: (text: string) => void
  }

  async function stopListening(options?: StopListeningOptions): Promise<string> {
    const fast = options?.fast ?? false
    endSentRef.current = true
    clearSilentTimer()
    const socket = socketRef.current
    const snapshot = (transcriptRef.current + interimRef.current).trim()
    stopRecorder()

    if (socket && socketOpenedRef.current) {
      try {
        socket.send({ data: JSON.stringify({ type: 'end' }) })
      } catch {
        /* ignore */
      }
    }

    const finishCleanup = (finalText: string) => {
      safeCloseSocket()
      setTranscript(finalText)
      setInterimTranscript('')
      transcriptRef.current = finalText
      interimRef.current = ''
      setIsListening(false)
      setIsConnecting(false)
      endSentRef.current = false
      frameBufferRef.current = []
    }

    if (fast) {
      setIsListening(false)
      setIsConnecting(false)

      void (async () => {
        if (socket && socketOpenedRef.current) {
          await waitForFinalResults(END_WAIT_FAST_MS)
        }
        const refined = (transcriptRef.current + interimRef.current).trim()
        finishCleanup(refined)
        if (refined && refined !== snapshot) {
          options?.onRefined?.(refined)
        }
      })()

      return snapshot
    }

    if (socket && socketOpenedRef.current) {
      await waitForFinalResults()
    }

    const finalText = (transcriptRef.current + interimRef.current).trim()
    finishCleanup(finalText)
    return finalText
  }

  return {
    transcript,
    interimTranscript,
    liveTranscript,
    isListening,
    isConnecting,
    isSupported: true,
    simulatorUnsupported,
    error,
    asrUnavailable,
    startListening,
    stopListening,
    getTranscript: () => (transcriptRef.current + interimRef.current).trim(),
    reset,
    clearError,
    minHoldMs: MIN_HOLD_MS,
  }
}

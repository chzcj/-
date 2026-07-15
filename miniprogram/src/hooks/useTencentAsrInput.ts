import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { ensureRecordPermission } from '@/lib/asrPermission'
import {
  recorderState,
  claimRecorder,
  releaseRecorderClaim,
  type RecorderClaim,
  type RecorderHandlers,
} from '@/lib/recorderState'
import { parseIflytekRtasrMessage } from '@/lib/iflytekRtasrParse'
import { apiRequest } from '@/services/api'

const FRAME_BUFFER_MAX = 64
const FLUSH_GAP_MS = 40
const END_WAIT_MS = 2000
const END_WAIT_FAST_MS = 600
const MIN_HOLD_MS = 100
const URL_TIMEOUT_MS = 8000
const HANDSHAKE_TIMEOUT_MS = 8000
const RELEASE_OPEN_GRACE_MS = 1500

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

type SocketHandlers = {
  onOpen: () => void
  onMessage: (msg: { data: string | ArrayBuffer }) => void
  onError: (res: unknown) => void
  onClose: (res: unknown) => void
}

function attachSocketHandlers(task: Taro.SocketTask, handlers: SocketHandlers) {
  task.onOpen(handlers.onOpen)
  task.onMessage(handlers.onMessage)
  task.onError(handlers.onError)
  task.onClose(handlers.onClose)
}

/**
 * 连接 ASR WebSocket —— 全链路只允许调用一次 connectSocket。
 *
 * 坑（本会话已踩）：若先 Taro.connectSocket（内部已 wx.connectSocket），因返回 Promise
 * 未通过 isSocketTask，再调一次 native，会：
 * 1) 同一签名 URL 被用两次（讯飞签名单次有效）→ Connection refused
 * 2) 泄漏未挂监听的 SocketTask，iOS 上 socketTaskId 堆高后整段 WSS 全拒
 *
 * 因此：有 wx 时只走原生一次，并在同一调用栈挂上全部监听；禁止 Taro+native 双开。
 */
function connectAsrSocket(url: string, handlers: SocketHandlers): Taro.SocketTask | null {
  try {
    let urlMark = url
    try {
      const u = new URL(url)
      urlMark = `${u.protocol}//${u.host}${u.pathname}`
    } catch {
      /* keep raw */
    }
    console.info('[asr-socket] connect start', urlMark)

    const nativeWx = (
      globalThis as {
        wx?: {
          connectSocket: (opts: {
            url: string
            complete?: () => void
            success?: (res: { errMsg?: string; socketTaskId?: string | number }) => void
            fail?: (err: unknown) => void
          }) => Taro.SocketTask
        }
      }
    ).wx

    if (!nativeWx?.connectSocket) {
      console.warn('[asr-socket] no wx.connectSocket')
      return null
    }

    // 唯一一次 connectSocket；success 只表示「发起成功」，不代表 onOpen。
    const task = nativeWx.connectSocket({
      url,
      complete: () => undefined,
      success: (res) => {
        console.info('[asr-socket] connectSocket success', res?.errMsg, 'taskId=', res?.socketTaskId)
      },
      fail: (err) => {
        console.warn('[asr-socket] connectSocket fail', err)
        handlers.onError(err)
      },
    }) as unknown as Taro.SocketTask

    if (!isSocketTask(task)) {
      console.warn('[asr-socket] connect returned non-task')
      return null
    }

    console.info('[asr-socket] single connect, registering listeners sync')
    attachSocketHandlers(task, handlers)
    return task
  } catch (e) {
    console.warn('[asr-socket] connect throw', e)
    return null
  }
}

function mapAsrError(code: string | undefined, fallback: string): string {
  if (code === 'ASR_UNCONFIGURED') return '语音服务未配置，可以先打字输入。'
  if (code === 'UNAUTHORIZED') return '登录已失效，请重新登录后再用语音。'
  return fallback
}

export function useTencentAsrInput() {
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState('')
  const [serviceUnavailable, setServiceUnavailable] = useState(false)

  const socketRef = useRef<Taro.SocketTask | null>(null)
  const socketOpenedRef = useRef(false)
  const transcriptRef = useRef('')
  const interimRef = useRef('')
  const recordingStartedRef = useRef(false)
  const claimRef = useRef<RecorderClaim | null>(null)
  const sessionIdRef = useRef('')
  const frameBufferRef = useRef<ArrayBuffer[]>([])
  const endSentRef = useRef(false)
  const finalWaitResolveRef = useRef<(() => void) | null>(null)
  const sessionGenRef = useRef(0)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openWaitersRef = useRef<Array<(ok: boolean) => void>>([])

  const simulatorUnsupported = isDevToolsSimulator()
  const liveTranscript = transcript + interimTranscript
  const asrUnavailable = serviceUnavailable

  function trace(event: string, extra?: Record<string, unknown>) {
    console.info('[asr-session]', event, {
      gen: sessionGenRef.current,
      opened: socketOpenedRef.current,
      recordingStarted: recordingStartedRef.current,
      active: recorderState.active,
      claimId: claimRef.current?.id || null,
      ...extra,
    })
  }

  useEffect(() => {
    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resolveFinalWait() {
    finalWaitResolveRef.current?.()
    finalWaitResolveRef.current = null
  }

  function clearFlushTimer() {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }

  function notifyOpenWaiters(ok: boolean) {
    const waiters = openWaitersRef.current
    openWaitersRef.current = []
    waiters.forEach((w) => w(ok))
  }

  function waitUntilOpen(maxMs: number): Promise<boolean> {
    if (socketOpenedRef.current) return Promise.resolve(true)
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        openWaitersRef.current = openWaitersRef.current.filter((w) => w !== onReady)
        resolve(false)
      }, maxMs)
      const onReady = (ok: boolean) => {
        clearTimeout(timer)
        resolve(ok)
      }
      openWaitersRef.current.push(onReady)
    })
  }

  function safeCloseSocket() {
    const socket = socketRef.current
    socketRef.current = null
    socketOpenedRef.current = false
    if (!socket || typeof socket.close !== 'function') return
    try {
      trace('socket close requested')
      socket.close({ success: () => undefined, fail: () => undefined })
    } catch (err) {
      trace('socket close throw', { errMsg: err instanceof Error ? err.message : '' })
    }
  }

  function stopRecorder() {
    if (!recordingStartedRef.current) {
      trace('recorder stop skipped: not started')
      return
    }
    recordingStartedRef.current = false
    // 预演页 navigateTo 后本 hook 仍存活；若亲子页已 claim，绝不能 stop 全局录音器
    const claim = claimRef.current
    if (claim && !claim.isMine()) {
      trace('recorder stop skipped: lost claim', { ownerClaimId: claim.id })
      claimRef.current = null
      return
    }
    recorderState.active = false
    try {
      trace('recorder stop requested')
      Taro.getRecorderManager().stop()
    } catch (err) {
      trace('recorder stop throw', { errMsg: err instanceof Error ? err.message : '' })
    }
    releaseRecorderClaim(claim)
    claimRef.current = null
  }

  function scheduleFlushBuffer() {
    if (flushTimerRef.current) return
    const pump = () => {
      flushTimerRef.current = null
      const socket = socketRef.current
      if (!socket || !socketOpenedRef.current || endSentRef.current) {
        frameBufferRef.current = []
        return
      }
      const next = frameBufferRef.current.shift()
      if (!next) return
      try {
        socket.send({ data: next })
      } catch {
        /* ignore */
      }
      if (frameBufferRef.current.length > 0) {
        flushTimerRef.current = setTimeout(pump, FLUSH_GAP_MS)
      }
    }
    flushTimerRef.current = setTimeout(pump, 0)
  }

  function pushFrame(frameBuffer: ArrayBuffer) {
    if (endSentRef.current) return
    // 讯飞建议约 40ms / 1280B；先入队再节流冲刷，避免 onOpen 后瞬时倾倒
    const buf = frameBufferRef.current
    if (buf.length >= FRAME_BUFFER_MAX) buf.shift()
    buf.push(frameBuffer)
    if (socketRef.current && socketOpenedRef.current) {
      scheduleFlushBuffer()
    }
  }

  function cleanup(reason = 'unspecified') {
    trace('cleanup', { reason })
    sessionGenRef.current += 1
    clearFlushTimer()
    resolveFinalWait()
    notifyOpenWaiters(false)
    stopRecorder()
    safeCloseSocket()
    frameBufferRef.current = []
    endSentRef.current = false
    setIsListening(false)
    setIsConnecting(false)
    setIsReady(false)
  }

  function reset() {
    cleanup('reset')
    setTranscript('')
    setInterimTranscript('')
    transcriptRef.current = ''
    interimRef.current = ''
    setError('')
  }

  function clearError() {
    setError('')
  }

  function handleIflytekPayload(raw: string, gen: number) {
    if (sessionGenRef.current !== gen) return
    const parsed = parseIflytekRtasrMessage(raw)
    if (!parsed) return

    if (parsed.isError) {
      setError(parsed.errorMessage || '语音识别暂时不可用，可以先打字。')
      cleanup('iflytek payload error')
      return
    }

    if (parsed.isStarted) {
      // end 帧必须用引擎返回的 sessionId，不能用 BFF 签名用的 uuid
      if (parsed.sessionId) sessionIdRef.current = parsed.sessionId
      return
    }

    if (parsed.isEnded) {
      if (endSentRef.current) resolveFinalWait()
      return
    }

    if (!parsed.text) return

    if (parsed.isFinal) {
      transcriptRef.current += parsed.text
      interimRef.current = ''
      setTranscript(transcriptRef.current)
      setInterimTranscript('')
      if (endSentRef.current) resolveFinalWait()
    } else {
      interimRef.current = parsed.text
      setInterimTranscript(parsed.text)
    }
  }

  function buildRecorderHandlers(gen: number): RecorderHandlers {
    return {
      onFrame: (frameBuffer) => {
        if (sessionGenRef.current !== gen) return
        if (claimRef.current && !claimRef.current.isMine()) return
        pushFrame(frameBuffer)
      },
      onStop: () => {
        if (sessionGenRef.current !== gen) return
        if (claimRef.current && !claimRef.current.isMine()) return
        recordingStartedRef.current = false
        recorderState.active = false
        trace('recorder onStop')
        if (!endSentRef.current) setIsListening(false)
      },
      onError: (err) => {
        if (sessionGenRef.current !== gen) return
        if (claimRef.current && !claimRef.current.isMine()) return
        // 空闲幽灵 onError：未真正开录成功则忽略（Claude「爽了」不变量）
        if (!recordingStartedRef.current) {
          trace('recorder ghost onError ignored', { errMsg: err?.errMsg || '' })
          return
        }
        recordingStartedRef.current = false
        recorderState.active = false
        const raw = err?.errMsg || '未知错误'
        const msg = raw.includes('auth')
          ? `录音失败，请检查麦克风权限。(${raw})`
          : `录音失败，可以先打字输入。(${raw})`
        setError(msg)
        cleanup('recorder onError')
      },
    }
  }

  function startRecorder(gen: number) {
    const handlers = buildRecorderHandlers(gen)
    claimRef.current = claimRecorder(handlers)
    try {
      Taro.getRecorderManager().start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        format: 'PCM',
        frameSize: 4,
      })
      recordingStartedRef.current = true
      recorderState.active = true
      trace('recorder start success')
      setIsListening(true)
    } catch (err) {
      recordingStartedRef.current = false
      trace('recorder start throw', { errMsg: err instanceof Error ? err.message : '' })
      setError('无法启动录音，可以先打字输入。')
      cleanup('recorder start throw')
    }
  }

  function waitForFinalResults(maxMs = END_WAIT_MS): Promise<void> {
    if (!socketRef.current || !socketOpenedRef.current) return Promise.resolve()
    return new Promise((resolve) => {
      finalWaitResolveRef.current = resolve
      setTimeout(() => resolveFinalWait(), maxMs)
    })
  }

  function sendEndFrame() {
    const socket = socketRef.current
    const sid = sessionIdRef.current
    // 没有引擎 sessionId 时不要用 BFF uuid 冒充，否则讯飞会拒 end / 提前断
    if (!socket || !socketOpenedRef.current || !sid) return
    try {
      socket.send({
        data: JSON.stringify({ end: true, sessionId: sid }),
      })
    } catch {
      /* ignore */
    }
  }

  async function startListening() {
    trace('startListening requested')
    setError('')
    setServiceUnavailable(false)
    setIsConnecting(true)
    setIsReady(false)

    if (simulatorUnsupported) {
      setIsConnecting(false)
      setError('模拟器不支持语音验收，请用真机预览按住说话。')
      return
    }

    const perm = await ensureRecordPermission({ interactive: false })
    if (!perm.ok) {
      setIsConnecting(false)
      setError(perm.message)
      return
    }

    cleanup('new startListening')
    const gen = sessionGenRef.current
    setIsConnecting(true)
    transcriptRef.current = ''
    interimRef.current = ''
    setTranscript('')
    setInterimTranscript('')
    endSentRef.current = false
    frameBufferRef.current = []

    const signerNonce = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const urlRes = await apiRequest<{ wsUrl: string; sessionId: string }>(
      `/api/asr/iflytek/url?nonce=${encodeURIComponent(signerNonce)}`,
      { method: 'GET', timeout: URL_TIMEOUT_MS }
    )
    if (sessionGenRef.current !== gen) return

    if (!urlRes.ok) {
      if (urlRes.error.code === 'ASR_UNCONFIGURED') setServiceUnavailable(true)
      setError(
        mapAsrError(
          urlRes.error.code,
          urlRes.error.message || '语音暂时不可用，可以先打字输入。'
        )
      )
      setIsConnecting(false)
      trace('sign url failed', { code: urlRes.error.code })
      return
    }

    // BFF sessionId 仅用于签名 uuid，不是引擎 end 所需 sessionId
    sessionIdRef.current = ''
    startRecorder(gen)

    let handshakeDone = false
    const finishHandshake = (ok: boolean) => {
      if (handshakeDone) return
      handshakeDone = true
      clearTimeout(handshakeTimer)
      if (!ok) {
        if (sessionGenRef.current === gen) {
          setError('语音连接超时，请再按住试一次，或点「文」改用文字。')
          cleanup('handshake failed')
        }
        notifyOpenWaiters(false)
        return
      }
      socketOpenedRef.current = true
      setIsConnecting(false)
      setIsReady(true)
      scheduleFlushBuffer()
      notifyOpenWaiters(true)
    }

    const handshakeTimer = setTimeout(() => finishHandshake(false), HANDSHAKE_TIMEOUT_MS)

    // 微信官方要求 connectSocket 调用后立即同步监听 onOpen；connectAsrSocket 内部用
    // 同步 wx.connectSocket + 同一调用栈注册回调，避免 await 让 onOpen 丢失。
    const socket = connectAsrSocket(urlRes.data.wsUrl, {
      onOpen: () => {
        console.info('[asr-socket] onOpen', gen, 'cur=', sessionGenRef.current)
        if (sessionGenRef.current !== gen) {
          trace('onOpen stale session', { connectGen: gen })
          finishHandshake(false)
          try {
            socketRef.current?.close({ success: () => undefined, fail: () => undefined })
          } catch {
            /* ignore */
          }
          return
        }
        trace('onOpen')
        finishHandshake(true)
      },
      onMessage: (msg) => {
        if (sessionGenRef.current !== gen) return
        const raw = typeof msg.data === 'string' ? msg.data : ''
        if (raw) handleIflytekPayload(raw, gen)
      },
      onError: (res) => {
        console.warn('[asr-socket] onError', gen, res)
        trace('socket onError', { raw: JSON.stringify(res) })
        if (sessionGenRef.current !== gen) return
        finishHandshake(false)
      },
      onClose: (res) => {
        console.warn('[asr-socket] onClose', gen, 'opened=', socketOpenedRef.current, res)
        trace('socket onClose', { raw: JSON.stringify(res) })
        if (socketRef.current) socketRef.current = null
        socketOpenedRef.current = false
        if (sessionGenRef.current === gen) {
          setIsConnecting(false)
          setIsReady(false)
          if (!endSentRef.current) setIsListening(false)
        }
        if (!handshakeDone) finishHandshake(false)
      },
    })

    if (sessionGenRef.current !== gen) return

    if (!socket) {
      setError('语音连接失败，请稍后重试，或点「文」改用文字。')
      cleanup()
      return
    }

    socketRef.current = socket
    socketOpenedRef.current = false
  }

  type StopListeningOptions = {
    fast?: boolean
    onRefined?: (text: string) => void
  }

  async function stopListening(options?: StopListeningOptions): Promise<string> {
    const fast = options?.fast ?? false
    const genAtStop = sessionGenRef.current
    const hadAudio =
      frameBufferRef.current.length > 0 ||
      isListening ||
      Boolean(transcriptRef.current || interimRef.current)

    if (hadAudio && !socketOpenedRef.current) {
      await waitUntilOpen(RELEASE_OPEN_GRACE_MS)
      if (sessionGenRef.current !== genAtStop) {
        return (transcriptRef.current + interimRef.current).trim()
      }
    }

    // 等引擎 started 带回真正 sessionId，再发 end（最多 ~800ms）
    if (socketOpenedRef.current && !sessionIdRef.current) {
      await new Promise<void>((resolve) => {
        const startedAt = Date.now()
        const tick = () => {
          if (sessionIdRef.current || Date.now() - startedAt > 800) {
            resolve()
            return
          }
          setTimeout(tick, 40)
        }
        tick()
      })
      if (sessionGenRef.current !== genAtStop) {
        return (transcriptRef.current + interimRef.current).trim()
      }
    }

    sessionGenRef.current += 1
    endSentRef.current = true
    clearFlushTimer()

    if (socketOpenedRef.current && frameBufferRef.current.length > 0) {
      const socket = socketRef.current
      const queue = frameBufferRef.current.splice(0)
      for (const buf of queue) {
        try {
          socket?.send({ data: buf })
        } catch {
          /* ignore */
        }
      }
    }

    const snapshot = (transcriptRef.current + interimRef.current).trim()
    sendEndFrame()
    stopRecorder()
    setIsListening(false)
    setIsConnecting(false)
    setIsReady(false)

    const finishCleanup = (finalText: string) => {
      safeCloseSocket()
      frameBufferRef.current = []
      setTranscript(finalText)
      setInterimTranscript('')
      transcriptRef.current = finalText
      interimRef.current = ''
      setIsListening(false)
      setIsConnecting(false)
      setIsReady(false)
      endSentRef.current = false
    }

    if (fast) {
      void (async () => {
        if (socketRef.current && socketOpenedRef.current) {
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

    if (socketRef.current && socketOpenedRef.current) {
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
    isReady,
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

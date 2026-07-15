import { useRef, useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { ensureRecordPermission } from '@/lib/asrPermission'
import {
  recorderState,
  claimRecorder,
  getRecorderSnapshot,
  releaseRecorderClaim,
  type RecorderClaim,
  type RecorderHandlers,
} from '@/lib/recorderState'

const MAX_MS = 10 * 60 * 1000
const MIN_MS = 2000
const TAKEOVER_WAIT_MS = 800

type TapRecorderState = {
  isRecording: boolean
  elapsedMs: number
  error: string
  filePath: string
}

/**
 * 点击开始 / 再次点击结束：整段录到本地文件（非实时 ASR）。
 * 与 useTencentAsrInput 共用全局 RecorderManager——必须用 claim 所有权，
 * 避免预演页隐藏后的实时 ASR cleanup 误杀本页录音。
 */
export function useTapFileRecorder() {
  const [state, setState] = useState<TapRecorderState>({
    isRecording: false,
    elapsedMs: 0,
    error: '',
    filePath: '',
  })
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveStopRef = useRef<((path: string) => void) | null>(null)
  const claimRef = useRef<RecorderClaim | null>(null)
  const recordingStartedRef = useRef(false)
  const sessionGenRef = useRef(0)

  function trace(event: string, extra?: Record<string, unknown>) {
    console.info('[tap-recorder]', event, {
      gen: sessionGenRef.current,
      isRecording: recordingStartedRef.current,
      active: recorderState.active,
      claimId: claimRef.current?.id || null,
      ...extra,
    })
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function buildRecorderHandlers(gen: number): RecorderHandlers {
    return {
      onStop: (res) => {
        if (sessionGenRef.current !== gen) return
        if (claimRef.current && !claimRef.current.isMine()) return
        recordingStartedRef.current = false
        recorderState.active = false
        clearTimer()
        const path = res.tempFilePath || ''
        trace('onStop', { tempFilePath: path })
        setState((s) => ({
          ...s,
          isRecording: false,
          filePath: path,
          elapsedMs: Date.now() - startedAtRef.current,
        }))
        resolveStopRef.current?.(path)
        resolveStopRef.current = null
      },
      onError: (err) => {
        if (sessionGenRef.current !== gen) return
        if (claimRef.current && !claimRef.current.isMine()) return
        const waitingTakeover =
          Boolean(resolveStopRef.current) && !recordingStartedRef.current
        trace('onError', { errMsg: err?.errMsg || '', waitingTakeover })
        // 未真正开录成功时的幽灵 onError 忽略；接管等待中的 stop 回调要放行
        if (!recordingStartedRef.current && !waitingTakeover) return
        recordingStartedRef.current = false
        recorderState.active = false
        clearTimer()
        if (waitingTakeover) {
          const done = resolveStopRef.current
          resolveStopRef.current = null
          done?.('')
          return
        }
        setState((s) => ({
          ...s,
          isRecording: false,
          error: err?.errMsg?.includes('auth')
            ? '录音失败，请检查麦克风权限。'
            : '录音失败，请重试。',
        }))
        resolveStopRef.current?.('')
        resolveStopRef.current = null
      },
    }
  }

  function waitForRecorderIdle(previous: ReturnType<typeof getRecorderSnapshot>): Promise<void> {
    if (!previous.active) {
      return Promise.resolve()
    }
    // active=true 但没有归属方，是历史残留状态；绝不可对空闲全局 recorder 调 stop。
    if (!previous.hasOwner) {
      trace('clear stale active without stop', previous)
      recorderState.active = false
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      const gen = sessionGenRef.current
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolveStopRef.current = null
        recorderState.active = false
        recordingStartedRef.current = false
        resolve()
      }
      resolveStopRef.current = () => finish()
      try {
        trace('takeover stop previous owner', previous)
        Taro.getRecorderManager().stop()
      } catch {
        finish()
        return
      }
      setTimeout(() => {
        if (sessionGenRef.current !== gen) return
        finish()
      }, TAKEOVER_WAIT_MS)
    })
  }

  async function start(): Promise<boolean> {
    setState((s) => ({ ...s, error: '', filePath: '' }))
    const perm = await ensureRecordPermission({ interactive: true })
    if (!perm.ok) {
      setState((s) => ({
        ...s,
        error: perm.message || '需要麦克风权限才能录音。可在设置中开启。',
      }))
      return false
    }

    sessionGenRef.current += 1
    const gen = sessionGenRef.current
    const handlers = buildRecorderHandlers(gen)
    const previous = getRecorderSnapshot()
    trace('start requested', { previous })
    claimRef.current = claimRecorder(handlers)

    // 预演页实时 ASR 可能仍占着全局录音器（页面隐藏未卸载）
    if (previous.active) {
      await waitForRecorderIdle(previous)
      if (sessionGenRef.current !== gen) return false
      claimRef.current = claimRecorder(handlers)
    }

    startedAtRef.current = Date.now()
    setState((s) => ({ ...s, isRecording: true, elapsedMs: 0, error: '' }))
    clearTimer()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current
      setState((s) => ({ ...s, elapsedMs: elapsed }))
      if (elapsed >= MAX_MS) {
        void stop()
      }
    }, 200)

    try {
      Taro.getRecorderManager().start({
        duration: MAX_MS,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3',
      })
      recordingStartedRef.current = true
      recorderState.active = true
      trace('start success')
      return true
    } catch (err) {
      clearTimer()
      recordingStartedRef.current = false
      recorderState.active = false
      trace('start throw', { errMsg: err instanceof Error ? err.message : '' })
      setState((s) => ({ ...s, isRecording: false, error: '无法开始录音' }))
      return false
    }
  }

  function stop(): Promise<{ filePath: string; elapsedMs: number; tooShort: boolean }> {
    return new Promise((resolve) => {
      const elapsed = Date.now() - startedAtRef.current
      if (!recordingStartedRef.current) {
        trace('stop ignored: not recording')
        resolve({ filePath: '', elapsedMs: elapsed, tooShort: true })
        return
      }
      resolveStopRef.current = (path) => {
        resolve({
          filePath: path,
          elapsedMs: elapsed,
          tooShort: elapsed < MIN_MS,
        })
      }
      try {
        trace('stop requested')
        Taro.getRecorderManager().stop()
      } catch (err) {
        trace('stop throw', { errMsg: err instanceof Error ? err.message : '' })
        clearTimer()
        recordingStartedRef.current = false
        recorderState.active = false
        setState((s) => ({ ...s, isRecording: false }))
        resolve({ filePath: '', elapsedMs: elapsed, tooShort: true })
      }
    })
  }

  function reset() {
    clearTimer()
    setState({ isRecording: false, elapsedMs: 0, error: '', filePath: '' })
  }

  // 页面卸载兜底：整段录音若未停就离开，会一直占用全局录音器
  useEffect(() => {
    return () => {
      sessionGenRef.current += 1
      clearTimer()
      const claim = claimRef.current
      if (recordingStartedRef.current && claim?.isMine()) {
        recordingStartedRef.current = false
        recorderState.active = false
        try {
          Taro.getRecorderManager().stop()
        } catch {
          /* ignore */
        }
      } else if (recordingStartedRef.current && !claim?.isMine()) {
        // 所有权已交给别人：只清本地标记，绝不 stop
        recordingStartedRef.current = false
      }
      releaseRecorderClaim(claim)
      claimRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    ...state,
    maxMs: MAX_MS,
    minMs: MIN_MS,
    start,
    stop,
    reset,
  }
}

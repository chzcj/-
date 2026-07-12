import { useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { ensureRecordPermission } from '@/lib/asrPermission'

const MAX_MS = 10 * 60 * 1000
const MIN_MS = 2000

type TapRecorderState = {
  isRecording: boolean
  elapsedMs: number
  error: string
  filePath: string
}

/**
 * 点击开始 / 再次点击结束：整段录到本地文件（非实时 ASR）。
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
  const boundRef = useRef(false)
  const resolveStopRef = useRef<((path: string) => void) | null>(null)

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function bindRecorder() {
    if (boundRef.current) return
    boundRef.current = true
    const recorder = Taro.getRecorderManager()
    recorder.onStop((res) => {
      clearTimer()
      const path = res.tempFilePath || ''
      setState((s) => ({
        ...s,
        isRecording: false,
        filePath: path,
        elapsedMs: Date.now() - startedAtRef.current,
      }))
      resolveStopRef.current?.(path)
      resolveStopRef.current = null
    })
    recorder.onError((err) => {
      clearTimer()
      setState((s) => ({
        ...s,
        isRecording: false,
        error: err?.errMsg?.includes('auth')
          ? '录音失败，请检查麦克风权限。'
          : '录音失败，请重试。',
      }))
      resolveStopRef.current?.('')
      resolveStopRef.current = null
    })
  }

  async function start(): Promise<boolean> {
    setState((s) => ({ ...s, error: '', filePath: '' }))
    const ok = await ensureRecordPermission()
    if (!ok) {
      setState((s) => ({
        ...s,
        error: '需要麦克风权限才能录音。可在设置中开启。',
      }))
      try {
        await Taro.showModal({
          title: '需要麦克风权限',
          content: '请在设置中允许育见使用麦克风',
          confirmText: '去设置',
          success: (r) => {
            if (r.confirm) void Taro.openSetting({})
          },
        })
      } catch {
        /* ignore */
      }
      return false
    }
    bindRecorder()
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
      return true
    } catch {
      clearTimer()
      setState((s) => ({ ...s, isRecording: false, error: '无法开始录音' }))
      return false
    }
  }

  function stop(): Promise<{ filePath: string; elapsedMs: number; tooShort: boolean }> {
    return new Promise((resolve) => {
      const elapsed = Date.now() - startedAtRef.current
      resolveStopRef.current = (path) => {
        resolve({
          filePath: path,
          elapsedMs: elapsed,
          tooShort: elapsed < MIN_MS,
        })
      }
      try {
        Taro.getRecorderManager().stop()
      } catch {
        clearTimer()
        setState((s) => ({ ...s, isRecording: false }))
        resolve({ filePath: '', elapsedMs: elapsed, tooShort: true })
      }
    })
  }

  function reset() {
    clearTimer()
    setState({ isRecording: false, elapsedMs: 0, error: '', filePath: '' })
  }

  return {
    ...state,
    maxMs: MAX_MS,
    minMs: MIN_MS,
    start,
    stop,
    reset,
  }
}

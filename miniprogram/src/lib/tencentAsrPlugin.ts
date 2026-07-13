/** 腾讯云智能语音插件 QCloudAIVoice（wx3e17776051baf153）类型声明 */

export type AsrVoiceResult = {
  voice_text_str?: string
  slice_type?: number
}

export type SpeechRecognizerManager = {
  start: (params: Record<string, unknown>) => void
  stop: () => void
  OnRecognitionStart?: (res: unknown) => void
  OnSentenceBegin?: (res: unknown) => void
  OnRecognitionResultChange?: (res: { result?: AsrVoiceResult }) => void
  OnSentenceEnd?: (res: { result?: AsrVoiceResult }) => void
  OnRecognitionComplete?: (res: unknown) => void
  OnError?: (res: { code?: number; message?: string; errMsg?: string }) => void
  OnRecorderStop?: () => void
}

export type QCloudAIVoicePlugin = {
  setQCloudSecret: (
    appId: number | string,
    secretId: string,
    secretKey: string,
    openLog: boolean,
    token?: string
  ) => void
  speechRecognizerManager: () => SpeechRecognizerManager
}

declare const requirePlugin: (name: string) => QCloudAIVoicePlugin

export function loadQCloudAsrPlugin(): QCloudAIVoicePlugin | null {
  try {
    if (typeof requirePlugin !== 'function') return null
    return requirePlugin('QCloudAIVoice')
  } catch {
    return null
  }
}

export function newVoiceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

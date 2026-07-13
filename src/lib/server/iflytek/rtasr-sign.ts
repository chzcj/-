import { createHmac, randomUUID } from 'node:crypto'

const DEFAULT_WS_BASE =
  'wss://office-api-ast-dx.iflyaisol.com/ast/communicate/v1'

export type IflytekRtasrConfig = {
  appId: string
  apiKey: string
  apiSecret: string
  wsBaseUrl?: string
  lang?: string
  audioEncode?: string
  sampleRate?: number
}

/** 讯飞文档要求：yyyy-MM-dd'T'HH:mm:ss+0800 */
export function formatIflytekUtc(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const oh = pad(Math.floor(Math.abs(offsetMin) / 60))
  const om = pad(Math.abs(offsetMin) % 60)
  return `${y}-${m}-${d}T${h}:${min}:${s}${sign}${oh}${om}`
}

function encodePair(key: string, value: string): string {
  return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

/**
 * 实时语音转写大模型握手 URL 签名。
 * @see https://www.xfyun.cn/doc/spark/asr_llm/rtasr_llm.html
 */
export function buildIflytekRtasrWsUrl(
  config: IflytekRtasrConfig,
  sessionId = randomUUID()
): { wsUrl: string; sessionId: string } {
  const lang = config.lang || 'autodialect'
  const audioEncode = config.audioEncode || 'pcm_s16le'
  const sampleRate = config.sampleRate ?? 16000
  const utc = formatIflytekUtc()

  const params: Record<string, string> = {
    accessKeyId: config.apiKey,
    appId: config.appId,
    audio_encode: audioEncode,
    lang,
    samplerate: String(sampleRate),
    utc,
    uuid: sessionId,
  }

  const baseString = Object.keys(params)
    .sort()
    .map((key) => encodePair(key, params[key]))
    .join('&')

  const signature = createHmac('sha1', config.apiSecret)
    .update(baseString)
    .digest('base64')

  const query = `${baseString}&${encodePair('signature', signature)}`
  const wsBase = (config.wsBaseUrl || DEFAULT_WS_BASE).replace(/\?.*$/, '')
  return {
    wsUrl: `${wsBase}?${query}`,
    sessionId,
  }
}

export function getIflytekRtasrConfigFromEnv(): IflytekRtasrConfig | null {
  const appId = process.env.IFLYTEK_APP_ID
  const apiKey = process.env.IFLYTEK_API_KEY
  const apiSecret = process.env.IFLYTEK_API_SECRET
  if (!appId || !apiKey || !apiSecret) return null
  return {
    appId,
    apiKey,
    apiSecret,
    wsBaseUrl: process.env.IFLYTEK_ASR_WS_URL || DEFAULT_WS_BASE,
    lang: process.env.IFLYTEK_ASR_LANG || 'autodialect',
    audioEncode: process.env.IFLYTEK_ASR_AUDIO_ENCODE || 'pcm_s16le',
    sampleRate: process.env.IFLYTEK_ASR_SAMPLE_RATE
      ? Number(process.env.IFLYTEK_ASR_SAMPLE_RATE)
      : 16000,
  }
}

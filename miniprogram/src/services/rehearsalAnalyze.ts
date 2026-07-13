import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/config/env'
import { getSessionToken } from '@/services/api'
import {
  mapAnalyzeToSecondMe,
  parseRehearsalStreamEvent,
  type RehearsalAnalyzeData,
} from '@/lib/rehearsalStream'

class ChunkLineBuffer {
  private decoder =
    typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null
  private textBuffer = ''
  private byteBuffer: Uint8Array | null = null

  push(chunk: ArrayBuffer): string[] {
    const incoming = new Uint8Array(chunk)
    let text: string

    if (this.decoder) {
      text = this.decoder.decode(incoming, { stream: true })
    } else {
      let merged: Uint8Array
      if (this.byteBuffer) {
        merged = new Uint8Array(this.byteBuffer.length + incoming.length)
        merged.set(this.byteBuffer)
        merged.set(incoming, this.byteBuffer.length)
        this.byteBuffer = null
      } else {
        merged = incoming
      }
      const split = splitCompleteUtf8(merged)
      this.byteBuffer = split.rest
      text = decodeUtf8Fallback(split.complete)
    }

    this.textBuffer += text
    const lines = this.textBuffer.split('\n')
    this.textBuffer = lines.pop() || ''
    return lines.filter((l) => l.trim())
  }

  flush(): string[] {
    if (this.decoder) {
      try {
        this.textBuffer += this.decoder.decode()
      } catch {
        /* ignore */
      }
    } else if (this.byteBuffer && this.byteBuffer.length > 0) {
      this.textBuffer += decodeUtf8Fallback(this.byteBuffer)
      this.byteBuffer = null
    }
    const tail = this.textBuffer.trim()
    this.textBuffer = ''
    return tail ? [tail] : []
  }
}

function splitCompleteUtf8(bytes: Uint8Array): { complete: Uint8Array; rest: Uint8Array | null } {
  if (bytes.length === 0) return { complete: bytes, rest: null }
  let i = bytes.length - 1
  let need = 0
  while (i >= 0 && (bytes[i] & 0xc0) === 0x80) {
    i -= 1
    need += 1
  }
  if (i < 0) return { complete: new Uint8Array(0), rest: bytes }
  const b = bytes[i]
  let expected = 0
  if ((b & 0x80) === 0) expected = 0
  else if ((b & 0xe0) === 0xc0) expected = 1
  else if ((b & 0xf0) === 0xe0) expected = 2
  else if ((b & 0xf8) === 0xf0) expected = 3
  else return { complete: bytes, rest: null }

  if (need < expected) {
    return {
      complete: bytes.subarray(0, i),
      rest: bytes.subarray(i),
    }
  }
  return { complete: bytes, rest: null }
}

function decodeUtf8Fallback(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  try {
    return decodeURIComponent(escape(out))
  } catch {
    return out
  }
}

function decodeArrayBuffer(buf: ArrayBuffer): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(new Uint8Array(buf))
  }
  return decodeUtf8Fallback(new Uint8Array(buf))
}

function isApiEnvelope(raw: string): boolean {
  const t = raw.trim()
  return t.startsWith('{') && t.includes('"ok"')
}

export type RehearsalAnalyzeCallbacks = {
  onReactionDelta?: (text: string) => void
  onFinal?: (data: RehearsalAnalyzeData) => void
  onError?: (message: string) => void
}

export type RehearsalAnalyzeResult = {
  data?: RehearsalAnalyzeData
  httpError?: string
}

export type RehearsalAnalyzeOptions = {
  profileContext?: {
    primaryConditionalProfile?: string
    dominantProtectiveStrategies?: string[]
    pendingHypotheses?: string[]
    parentNarrativePattern?: string
    evidenceSnippets?: string[]
  }
  rehearsalContext?: {
    parentGoal?: string
    parentWorry?: string
    whatHappenedBeforeTalk?: string
    sceneTitle?: string
    sceneSummary?: string
  }
  /** 本场已发生的多轮对话（含本轮家长句） */
  rehearsalTranscript?: Array<{ role: 'parent' | 'child'; text: string }>
}

export function analyzeRehearsalTurn(
  parentText: string,
  parentRoundCount: number,
  callbacks: RehearsalAnalyzeCallbacks,
  options?: RehearsalAnalyzeOptions
): Promise<RehearsalAnalyzeResult> {
  const lineBuffer = new ChunkLineBuffer()
  let reactionAccum = ''
  let streamMode: 'unknown' | 'ndjson' | 'json' = 'unknown'
  let finalData: RehearsalAnalyzeData | null = null
  const result: RehearsalAnalyzeResult = {}

  const handleLine = (line: string) => {
    if (streamMode === 'json') return
    const evt = parseRehearsalStreamEvent(line)
    if (!evt) return
    streamMode = 'ndjson'
    if (evt.type === 'reaction_delta') {
      reactionAccum += evt.delta
      callbacks.onReactionDelta?.(reactionAccum)
    } else if (evt.type === 'final') {
      finalData = { ...(evt.data as RehearsalAnalyzeData), traceId: evt.traceId }
    } else if (evt.type === 'error') {
      callbacks.onError?.(evt.message || '预演暂时中断')
    }
  }

  const processBufferedText = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (streamMode === 'ndjson') {
      for (const line of trimmed.split('\n')) handleLine(line)
      return
    }
    if (isApiEnvelope(trimmed)) {
      streamMode = 'json'
      try {
        const json = JSON.parse(trimmed) as {
          ok?: boolean
          data?: RehearsalAnalyzeData & { traceId?: string }
          error?: { message?: string }
        }
        if (json.ok && json.data) {
          finalData = json.data
          const reply = mapAnalyzeToSecondMe(json.data)
          callbacks.onReactionDelta?.(reply.childText)
          return
        }
        callbacks.onError?.(json.error?.message || '预演暂时中断')
      } catch {
        callbacks.onError?.('预演返回格式异常')
      }
      return
    }
    for (const line of trimmed.split('\n')) handleLine(line)
  }

  return new Promise((resolve) => {
    const token = getSessionToken()
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      for (const line of lineBuffer.flush()) handleLine(line)
      if (finalData) {
        callbacks.onFinal?.(finalData)
        result.data = finalData
      } else if (!result.httpError) {
        result.httpError = '这次没有模拟出来，可以再试一次。'
      }
      resolve(result)
    }

    const task = Taro.request({
      url: `${API_BASE_URL}/api/rehearsal/analyze`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      data: {
        parentText,
        fromSpecialFeature: true,
        parentRoundCount,
        ...(options?.profileContext ? { profileContext: options.profileContext } : {}),
        ...(options?.rehearsalContext ? { rehearsalContext: options.rehearsalContext } : {}),
        ...(options?.rehearsalTranscript?.length
          ? { rehearsalTranscript: options.rehearsalTranscript }
          : {}),
      },
      enableChunked: true,
      enableHttp2: false,
      responseType: 'arraybuffer',
      timeout: 180000,
      success: (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          result.httpError = '这次没有模拟出来，可以再试一次。'
          resolve(result)
          return
        }
        if (res.data && streamMode !== 'ndjson') {
          processBufferedText(decodeArrayBuffer(res.data as ArrayBuffer))
        }
        finish()
      },
      fail: (err) => {
        result.httpError = err.errMsg || '网络不太稳定'
        resolve(result)
      },
    })

    const reqTask = task as Taro.RequestTask<unknown> & {
      onChunkReceived?: (cb: (res: { data: ArrayBuffer }) => void) => void
    }
    if (reqTask.onChunkReceived) {
      reqTask.onChunkReceived((res) => {
        for (const line of lineBuffer.push(res.data)) handleLine(line)
      })
    } else {
      // 无 chunked 时 success 回调处理整包
    }
  })
}

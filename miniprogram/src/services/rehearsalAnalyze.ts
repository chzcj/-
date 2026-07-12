import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/config/env'
import { getSessionToken } from '@/services/api'
import {
  mapAnalyzeToSecondMe,
  parseRehearsalStreamEvent,
  type RehearsalAnalyzeData,
} from '@/lib/rehearsalStream'

class ChunkLineBuffer {
  private byteBuffer: Uint8Array | null = null
  private textBuffer = ''

  push(chunk: ArrayBuffer): string[] {
    const incoming = new Uint8Array(chunk)
    let merged: Uint8Array
    if (this.byteBuffer) {
      merged = new Uint8Array(this.byteBuffer.length + incoming.length)
      merged.set(this.byteBuffer)
      merged.set(incoming, this.byteBuffer.length)
      this.byteBuffer = null
    } else {
      merged = incoming
    }

    let text: string
    try {
      text = decodeUtf8(merged)
    } catch {
      this.byteBuffer = merged
      return []
    }

    this.textBuffer += text
    const lines = this.textBuffer.split('\n')
    this.textBuffer = lines.pop() || ''
    return lines.filter((l) => l.trim())
  }

  flush(): string[] {
    const tail = this.textBuffer.trim()
    this.textBuffer = ''
    return tail ? [tail] : []
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes)
  }
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  try {
    return decodeURIComponent(escape(out))
  } catch {
    return out
  }
}

function decodeArrayBuffer(buf: ArrayBuffer): string {
  return decodeUtf8(new Uint8Array(buf))
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
  }
  rehearsalContext?: {
    parentGoal?: string
    parentWorry?: string
    whatHappenedBeforeTalk?: string
    sceneTitle?: string
    sceneSummary?: string
  }
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

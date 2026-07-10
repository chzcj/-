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

export type RehearsalAnalyzeCallbacks = {
  onReactionDelta?: (text: string) => void
  onFinal?: (data: RehearsalAnalyzeData) => void
  onError?: (message: string) => void
}

export type RehearsalAnalyzeResult = {
  data?: RehearsalAnalyzeData
  httpError?: string
}

export function analyzeRehearsalTurn(
  parentText: string,
  parentRoundCount: number,
  callbacks: RehearsalAnalyzeCallbacks
): Promise<RehearsalAnalyzeResult> {
  const lineBuffer = new ChunkLineBuffer()
  let reactionAccum = ''
  let childBubbleStarted = false
  let finalData: RehearsalAnalyzeData | null = null
  const result: RehearsalAnalyzeResult = {}

  const handleLine = (line: string) => {
    const evt = parseRehearsalStreamEvent(line)
    if (!evt) return
    if (evt.type === 'reaction_delta') {
      reactionAccum += evt.delta
      if (!childBubbleStarted) {
        childBubbleStarted = true
        callbacks.onReactionDelta?.(reactionAccum)
      } else {
        callbacks.onReactionDelta?.(reactionAccum)
      }
    } else if (evt.type === 'final') {
      finalData = { ...(evt.data as RehearsalAnalyzeData), traceId: evt.traceId }
    } else if (evt.type === 'error') {
      callbacks.onError?.(evt.message || '预演暂时中断')
    }
  }

  const finishJsonBody = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (trimmed.startsWith('{') && trimmed.includes('"ok"')) {
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
        if (res.data) {
          finishJsonBody(decodeArrayBuffer(res.data as ArrayBuffer))
        }
        for (const line of lineBuffer.flush()) handleLine(line)
        if (finalData) {
          callbacks.onFinal?.(finalData)
          result.data = finalData
        } else if (!result.httpError) {
          result.httpError = '这次没有模拟出来，可以再试一次。'
        }
        resolve(result)
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
    }
  })
}

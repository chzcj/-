import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '@/config/env'
import type { DailyAction, DailySection, DailyThinkingChip } from '@yujian/contracts'
import {
  parseDailyStreamLine,
  type DailyStreamResult,
} from '@yujian/contracts'
import { API_BASE_URL } from '@/config/env'
import { getSessionToken } from '@/services/api'

export type DailyTurn = {
  role: 'parent' | 'ai'
  text: string
  traceId?: string
  linkedAreas?: string[]
  sections?: DailySection[]
  actions?: DailyAction[]
  memoryLabel?: string
  streaming?: boolean
  sectionsComplete?: boolean
  proseComplete?: boolean
  thinkingChips?: DailyThinkingChip[]
  showThinking?: boolean
  deepExpanded?: boolean
  interrupted?: boolean
  sectionErrors?: string[]
}

export function loadDailyThread(): DailyTurn[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEYS.dailyThread)
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveDailyThread(turns: DailyTurn[]) {
  try {
    Taro.setStorageSync(STORAGE_KEYS.dailyThread, JSON.stringify(turns.slice(-30)))
  } catch {
    /* ignore */
  }
}

export type SectionStreamHandlers = {
  onSectionStart?: (section: DailySection) => void
  onSectionDelta?: (id: string, text: string) => void
  onSectionComplete?: (section: DailySection) => void
  onSectionError?: (id: string, message?: string) => void
  onSectionsComplete?: (sections: DailySection[]) => void
  onProseComplete?: () => void
}

export type DailyStreamCallbacks = {
  onDelta: (text: string) => void
  onThinking?: (chips: DailyThinkingChip[]) => void
  onStart?: (traceId: string) => void
} & SectionStreamHandlers & {
  onActions?: (actions: DailyAction[]) => void
}

/** NDJSON 粘包缓冲：ArrayBuffer → UTF-8 字符串（stream decode 防截断乱码） */
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

/** 把末尾不完整 UTF-8 序列留到下次 */
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

export function streamDailyMessage(
  text: string,
  callbacks: DailyStreamCallbacks,
  options?: {
    warmTurn?: boolean
    abortRef?: { aborted: boolean }
    recentSectionIds?: string[]
    taskRef?: { current: Taro.RequestTask<unknown> | null }
  }
): Promise<DailyStreamResult> {
  const state: DailyStreamResult = { acc: '' }
  const lineBuffer = new ChunkLineBuffer()
  let startFired = false
  let actionsFired = false
  let task: Taro.RequestTask<unknown> | null = null

  const flushPending = () => {
    if (state.pendingSectionStart && callbacks.onSectionStart) {
      callbacks.onSectionStart(state.pendingSectionStart)
      state.pendingSectionStart = undefined
    }
    if (state.pendingSectionDelta && callbacks.onSectionDelta) {
      callbacks.onSectionDelta(state.pendingSectionDelta.id, state.pendingSectionDelta.text)
      state.pendingSectionDelta = undefined
    }
    if (state.pendingSectionComplete && callbacks.onSectionComplete) {
      callbacks.onSectionComplete(state.pendingSectionComplete)
      state.pendingSectionComplete = undefined
    }
    if (state.pendingSectionError && callbacks.onSectionError) {
      callbacks.onSectionError(state.pendingSectionError.id, state.pendingSectionError.message)
      state.pendingSectionError = undefined
    }
    if (state.pendingProseComplete) {
      callbacks.onProseComplete?.()
      state.pendingProseComplete = undefined
    }
    if (state.pendingSectionsComplete) {
      callbacks.onSectionsComplete?.(state.pendingSectionsComplete)
      state.pendingSectionsComplete = undefined
    }
  }

  const processLine = (line: string) => {
    const prevAcc = state.acc
    const prevThinking = state.thinkingChips
    parseDailyStreamLine(line, state)
    if (state.traceId && !startFired && callbacks.onStart) {
      startFired = true
      callbacks.onStart(state.traceId)
    }
    if (state.acc.length > prevAcc.length) {
      callbacks.onDelta(state.acc)
    }
    if (state.thinkingChips && state.thinkingChips !== prevThinking && callbacks.onThinking) {
      callbacks.onThinking(state.thinkingChips)
    }
    flushPending()
    if (state.earlyActions && callbacks.onActions) {
      callbacks.onActions(state.earlyActions)
      state.earlyActions = undefined
      actionsFired = true
    }
  }

  return new Promise((resolve) => {
    const token = getSessionToken()
    task = Taro.request({
      url: `${API_BASE_URL}/api/daily/stream`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      data: {
        text,
        warmTurn: options?.warmTurn,
        recentSectionIds: options?.recentSectionIds || [],
      },
      enableChunked: true,
      enableHttp2: false,
      responseType: 'arraybuffer',
      timeout: 180000,
      success: (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          state.httpError = '这次没有整理成功，可以再试一次。'
          resolve(state)
          return
        }
        for (const line of lineBuffer.flush()) processLine(line)
        flushPending()
        if (!actionsFired && state.finalActions?.length && callbacks.onActions) {
          callbacks.onActions(state.finalActions)
        }
        resolve(state)
      },
      fail: (err) => {
        if (options?.abortRef?.aborted) {
          resolve(state)
          return
        }
        state.httpError = err.errMsg || '网络请求失败'
        resolve(state)
      },
    })

    if (options?.taskRef) options.taskRef.current = task

    const reqTask = task as Taro.RequestTask<unknown> & {
      onChunkReceived?: (cb: (res: { data: ArrayBuffer }) => void) => void
    }

    if (reqTask.onChunkReceived) {
      reqTask.onChunkReceived((res) => {
        if (options?.abortRef?.aborted) return
        for (const line of lineBuffer.push(res.data)) {
          processLine(line)
        }
      })
    }
  })
}

export function abortStream(task: Taro.RequestTask<unknown> | null) {
  try {
    task?.abort()
  } catch {
    /* ignore */
  }
}

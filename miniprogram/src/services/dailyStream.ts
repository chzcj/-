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

/** NDJSON 粘包缓冲：ArrayBuffer → UTF-8 字符串 */
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

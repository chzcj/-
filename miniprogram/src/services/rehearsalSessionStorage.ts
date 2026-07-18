import Taro from '@tarojs/taro'
import type { RehearsalAnalyzeData } from '@/lib/rehearsalStream'
import type { SimulationStep } from '@/data/rehearsalScenes'

const STORAGE_KEY = 'childos_rehearsal_active_session'
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const MAX_FEED_ITEMS = 40

export type RehearsalFeedItem =
  | { type: 'parent'; text: string }
  | {
      type: 'child'
      childText: string
      hintTitle: string
      hintText: string
      suggestedTitle?: string
      suggestedText?: string
    }
  | { type: 'system_hint'; text: string }

export type RehearsalActiveSession = {
  version: 1
  savedAt: string
  step: SimulationStep
  selectedId: string
  summary: string
  sceneTitle: string
  statusText: string
  feed: RehearsalFeedItem[]
  round: number
  roundsSinceCheckpoint: number
  showCheckpoint: boolean
  endData: RehearsalAnalyzeData | null
  rehearsalTraceId?: string
  taskSaved: boolean
  tonightSaved: boolean
  sourceAnalysisId?: string
}

export function saveRehearsalSession(session: RehearsalActiveSession): void {
  try {
    const feed = session.feed.slice(-MAX_FEED_ITEMS)
    Taro.setStorageSync(STORAGE_KEY, {
      ...session,
      feed,
      savedAt: new Date().toISOString(),
    })
  } catch {
    /* ignore quota */
  }
}

export function loadRehearsalSession(): RehearsalActiveSession | null {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY) as RehearsalActiveSession | ''
    if (!raw || typeof raw !== 'object' || raw.version !== 1) return null
    if (!raw.step || raw.step === 'entry') return null
    const age = Date.now() - new Date(raw.savedAt || 0).getTime()
    if (!Number.isFinite(age) || age > MAX_AGE_MS) {
      clearRehearsalSession()
      return null
    }
    return raw
  } catch {
    return null
  }
}

export function clearRehearsalSession(): void {
  try {
    Taro.removeStorageSync(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function loadLastDialogueAnalysisId(): string | null {
  try {
    const id = Taro.getStorageSync('childos_last_dialogue_analysis_id')
    return typeof id === 'string' && id.startsWith('da_') ? id : null
  } catch {
    return null
  }
}

import Taro from '@tarojs/taro'
import type { RehearsalScene } from '@/data/rehearsalScenes'

const KEY = 'childos_rehearsal_scenes_cache_v1'
/** 超过此时长仍可展示，但下次进入应后台刷新 */
const SOFT_TTL_MS = 90_000
/** 超过此时长才丢弃缓存（避免登录后空白缓冲） */
const HARD_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type RehearsalScenesCache = {
  at: number
  scenes: RehearsalScene[]
  rankedFromDialogue: boolean
  /** true = 已过软 TTL，建议静默刷新 */
  stale?: boolean
}

export function readRehearsalScenesCache(opts?: { allowStale?: boolean }): RehearsalScenesCache | null {
  const allowStale = opts?.allowStale !== false
  try {
    const parsed = Taro.getStorageSync(KEY) as RehearsalScenesCache | ''
    if (!parsed || typeof parsed !== 'object' || !parsed.at) return null
    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) return null
    const age = Date.now() - parsed.at
    if (!Number.isFinite(age) || age < 0) return null
    if (age > HARD_TTL_MS) return null
    const stale = age > SOFT_TTL_MS
    if (stale && !allowStale) return null
    return { ...parsed, stale }
  } catch {
    return null
  }
}

export function writeRehearsalScenesCache(scenes: RehearsalScene[], rankedFromDialogue: boolean) {
  try {
    Taro.setStorageSync(KEY, {
      at: Date.now(),
      scenes,
      rankedFromDialogue,
    } satisfies RehearsalScenesCache)
  } catch {
    /* ignore quota */
  }
}

export function invalidateRehearsalScenesCache() {
  try {
    Taro.removeStorageSync(KEY)
  } catch {
    /* ignore */
  }
}

export function writeLastDialogueAnalysisId(analysisId: string) {
  if (!analysisId.startsWith('da_')) return
  try {
    Taro.setStorageSync('childos_last_dialogue_analysis_id', analysisId)
  } catch {
    /* ignore */
  }
}

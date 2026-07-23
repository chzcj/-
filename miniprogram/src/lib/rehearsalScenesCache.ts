import Taro from '@tarojs/taro'
import type { RehearsalScene } from '@/data/rehearsalScenes'

const KEY = 'childos_rehearsal_scenes_cache_v1'
const TTL_MS = 90_000

export type RehearsalScenesCache = {
  at: number
  scenes: RehearsalScene[]
  rankedFromDialogue: boolean
}

export function readRehearsalScenesCache(): RehearsalScenesCache | null {
  try {
    const parsed = Taro.getStorageSync(KEY) as RehearsalScenesCache | ''
    if (!parsed || typeof parsed !== 'object' || !parsed.at) return null
    if (Date.now() - parsed.at > TTL_MS) return null
    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) return null
    return parsed
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

import type { RehearsalScene } from '@/data/rehearsalScenes'

const KEY = 'childos_rehearsal_scenes_cache_v1'
const TTL_MS = 90_000

export type RehearsalScenesCache = {
  at: number
  scenes: RehearsalScene[]
  rankedFromDialogue: boolean
}

export function readRehearsalScenesCache(): RehearsalScenesCache | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RehearsalScenesCache
    if (!parsed?.at || Date.now() - parsed.at > TTL_MS) return null
    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) return null
    return parsed
  } catch {
    return null
  }
}

export function writeRehearsalScenesCache(scenes: RehearsalScene[], rankedFromDialogue: boolean) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ at: Date.now(), scenes, rankedFromDialogue } satisfies RehearsalScenesCache)
    )
  } catch {
    /* ignore */
  }
}

export function invalidateRehearsalScenesCache() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

const LAST_ANALYSIS_KEY = 'childos_last_dialogue_analysis_id'

export function readLastDialogueAnalysisId(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const id = localStorage.getItem(LAST_ANALYSIS_KEY)
    return typeof id === 'string' && id.startsWith('da_') ? id : null
  } catch {
    return null
  }
}

export function writeLastDialogueAnalysisId(analysisId: string) {
  if (typeof localStorage === 'undefined') return
  if (!analysisId.startsWith('da_')) return
  try {
    localStorage.setItem(LAST_ANALYSIS_KEY, analysisId)
  } catch {
    /* ignore */
  }
}

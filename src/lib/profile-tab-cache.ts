/** 画像 Tab 短时缓存，避免每次切 Tab 都打 3 个 GET */
const KEY = 'childos_profile_tab_cache_v1'
const TTL_MS = 90_000

type ProfileTabCache = {
  at: number
  built: unknown
  snapshot: unknown
  weekly: unknown
}

export function readProfileTabCache(): ProfileTabCache | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProfileTabCache
    if (!parsed?.at || Date.now() - parsed.at > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function writeProfileTabCache(partial: Partial<Omit<ProfileTabCache, 'at'>>) {
  try {
    const prev = readProfileTabCache() || { at: 0, built: null, snapshot: null, weekly: null }
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        at: Date.now(),
        built: partial.built !== undefined ? partial.built : prev.built,
        snapshot: partial.snapshot !== undefined ? partial.snapshot : prev.snapshot,
        weekly: partial.weekly !== undefined ? partial.weekly : prev.weekly,
      }),
    )
  } catch {
    /* ignore */
  }
}

export function invalidateProfileTabCache() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

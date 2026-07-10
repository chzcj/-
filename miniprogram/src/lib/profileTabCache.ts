import Taro from '@tarojs/taro'

const CACHE_KEY = 'childos_profile_tab_cache_v1'
const TTL_MS = 90_000

export type ProfileTabCache = {
  ts: number
  built?: unknown
  snapshot?: unknown
  weekly?: unknown
  hub?: unknown
}

export function readProfileTabCache(): ProfileTabCache | null {
  try {
    const raw = Taro.getStorageSync(CACHE_KEY)
    if (!raw) return null
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ProfileTabCache
    if (!parsed?.ts || Date.now() - parsed.ts > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function writeProfileTabCache(patch: Partial<Omit<ProfileTabCache, 'ts'>>) {
  try {
    const prev = readProfileTabCache() || { ts: Date.now() }
    Taro.setStorageSync(
      CACHE_KEY,
      JSON.stringify({ ...prev, ...patch, ts: Date.now() })
    )
  } catch {
    /* ignore */
  }
}

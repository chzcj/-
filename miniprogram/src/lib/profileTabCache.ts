import Taro from '@tarojs/taro'

const CACHE_KEY = 'childos_profile_tab_cache_v1'
const LAST_PACK_KEY = 'childos_handbook_pack_last_v1'
const TTL_MS = 90_000

export type ProfileTabCache = {
  ts: number
  built?: unknown
  snapshot?: unknown
  weekly?: unknown
  hub?: unknown
  handbookPack?: unknown
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

/** 子页 stale-while-revalidate：持久化最近一份 pack（24h） */
export function readLastHandbookPack<T = unknown>(): T | null {
  try {
    const raw = Taro.getStorageSync(LAST_PACK_KEY)
    if (!raw) return null
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { ts: number; data: T }
    if (!parsed?.data || Date.now() - parsed.ts > 24 * 60 * 60 * 1000) return null
    return parsed.data
  } catch {
    return null
  }
}

export function writeLastHandbookPack(data: unknown) {
  try {
    Taro.setStorageSync(LAST_PACK_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    /* ignore */
  }
}

import type { ChildOSLocalStorageV1 } from '@/types/storage'
import { createInitialStorage } from './storageSeed'

const STORAGE_KEY = 'childos.v1'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function getStorage(): ChildOSLocalStorageV1 {
  if (!isBrowser()) return createInitialStorage()
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const initial = createInitialStorage()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }
  try {
    const parsed = JSON.parse(raw) as ChildOSLocalStorageV1
    if (parsed.version !== 'childos.storage.v1') return resetStorage()
    return parsed
  } catch {
    return resetStorage()
  }
}

export function setStorage(next: ChildOSLocalStorageV1) {
  if (!isBrowser()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }))
}

export function resetStorage() {
  const initial = createInitialStorage()
  if (isBrowser()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
  return initial
}

export function updateStorage(updater: (current: ChildOSLocalStorageV1) => ChildOSLocalStorageV1) {
  const current = getStorage()
  const next = updater(current)
  setStorage(next)
  return next
}

/* 清空本浏览器所有 ChildOS 本地数据（local + session 中 childos 前缀键）。
   登录/登出时调用，防同一浏览器切换账号串到上一位用户的画像与状态。
   DB 是真数据源（画像/记忆均按租户隔离持久化），清本地缓存无损。 */
export function clearAllChildOSData() {
  if (!isBrowser()) return
  try {
    for (const store of [window.localStorage, window.sessionStorage]) {
      const keys: string[] = []
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i)
        if (k && k.startsWith('childos')) keys.push(k)
      }
      keys.forEach(k => store.removeItem(k))
    }
  } catch {
    /* storage 不可用，忽略 */
  }
}

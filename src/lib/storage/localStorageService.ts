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

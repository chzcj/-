import { loadDailyThread, saveDailyThread, type DailyTurn } from '@/lib/daily/dailyStreamClient'
import { syncLocalProfileToServerIfNeeded } from '@/lib/profile/profileSync'
import { getStorage, setStorage } from '@/lib/storage/localStorageService'
import type { ChildOSLocalStorageV1 } from '@/types/storage'

function collectAccountPayload() {
  const storage = getStorage()
  return {
    dailyThread: loadDailyThread(),
    storage: storage as unknown as Record<string, unknown>,
  }
}

/** 强制把本机账号数据（画像、四模块、对话、localStorage）上传到服务器 */
export async function forceAccountSyncToServer(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  await syncLocalProfileToServerIfNeeded()

  try {
    const payload = collectAccountPayload()
    const res = await fetch('/api/account/state', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json()) as { ok?: boolean }
    return res.ok && json.ok === true
  } catch {
    return false
  }
}

export function pushAccountSyncToServer(): void {
  if (typeof window === 'undefined') return
  void forceAccountSyncToServer()
}

export async function restoreAccountStateFromServer(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const res = await fetch('/api/account/state', { credentials: 'include' })
    if (!res.ok) return
    const json = (await res.json()) as {
      ok?: boolean
      data?: {
        backup?: {
          dailyThread?: DailyTurn[]
          storage?: Record<string, unknown> | null
        } | null
      }
    }
    const backup = json.data?.backup
    if (!json.ok || !backup) return

    if (
      backup.storage &&
      typeof backup.storage === 'object' &&
      (backup.storage as ChildOSLocalStorageV1).version === 'childos.storage.v1'
    ) {
      setStorage(backup.storage as ChildOSLocalStorageV1)
    }

    if (Array.isArray(backup.dailyThread) && backup.dailyThread.length > 0) {
      saveDailyThread(backup.dailyThread)
    }
  } catch {
    /* ignore */
  }
}

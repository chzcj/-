import { loadDailyThread, saveDailyThread, type DailyTurn } from '@/services/dailyStream'
import { apiRequest } from '@/services/api'
import { assembleChildOSV1, hydrateFromChildOSV1, isV1Storage } from '@/services/childosV1Storage'
import { syncLocalProfileToServerIfNeeded } from '@/services/profileSync'

type AccountBackup = {
  dailyThread?: DailyTurn[]
  storage?: Record<string, unknown> | null
}

/** 从服务器恢复对话线程与完整 childos.v1（换机/重装后） */
export async function restoreAccountStateFromServer(): Promise<void> {
  const res = await apiRequest<{ backup?: AccountBackup | null }>('/api/account/state', {
    method: 'GET',
  })
  if (!res.ok || !res.data.backup) return

  const backup = res.data.backup

  if (backup.storage && isV1Storage(backup.storage)) {
    hydrateFromChildOSV1(backup.storage)
  }

  if (Array.isArray(backup.dailyThread) && backup.dailyThread.length > 0) {
    saveDailyThread(backup.dailyThread)
  }
}

/** 上传本机缓存到服务器（登出/换账号前调用） */
export async function forceAccountSyncToServer(): Promise<boolean> {
  await syncLocalProfileToServerIfNeeded()

  const payload = {
    dailyThread: loadDailyThread(),
    storage: assembleChildOSV1() as unknown as Record<string, unknown>,
  }
  const res = await apiRequest<{ saved?: boolean }>('/api/account/state', {
    method: 'POST',
    data: payload,
  })
  return res.ok && Boolean(res.data.saved)
}

export function pushAccountSyncToServer(): void {
  void forceAccountSyncToServer()
}

import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '@/config/env'
import { assembleChildOSV1 } from '@/services/childosV1Storage'

export type ChildBasicInfo = {
  childName: string
  grade: string
}

const BASIC_KEY = 'childos_child_basic'

export function loadChildBasicInfo(): ChildBasicInfo {
  try {
    const raw = Taro.getStorageSync(BASIC_KEY)
    if (!raw) return { childName: '', grade: '' }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return {
      childName: String(parsed.childName || parsed.nickname || ''),
      grade: String(parsed.grade || ''),
    }
  } catch {
    return { childName: '', grade: '' }
  }
}

export function saveChildBasicInfoLocal(info: ChildBasicInfo) {
  Taro.setStorageSync(BASIC_KEY, JSON.stringify(info))
}

export function isBasicInfoComplete(): boolean {
  const { childName, grade } = loadChildBasicInfo()
  return Boolean(childName.trim() && grade.trim())
}

export function getChildDisplayName(): string {
  const { childName } = loadChildBasicInfo()
  return childName.trim() || '孩子'
}

/** 与网页版 account backup 的 storage 结构对齐 */
export function buildAccountStoragePayload(_child?: ChildBasicInfo) {
  return assembleChildOSV1()
}

export async function saveChildBasicInfo(info: ChildBasicInfo): Promise<boolean> {
  saveChildBasicInfoLocal(info)
  const { pushAccountSyncToServer } = await import('@/services/accountSync')
  pushAccountSyncToServer()
  const { syncBuildProgressToServer } = await import('@/services/buildState')
  await syncBuildProgressToServer({ basicInfoDone: true })
  return true
}

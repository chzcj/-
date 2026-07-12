import Taro from '@tarojs/taro'

const PARENT_INFO_KEY = 'childos_parent_info'

export type ParentInfo = {
  identity: string
  nickname: string
  updatedAt: number
}

export function loadParentInfo(): ParentInfo {
  try {
    const raw = Taro.getStorageSync(PARENT_INFO_KEY)
    const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
    return {
      identity: String(parsed?.identity || '妈妈'),
      nickname: String(parsed?.nickname || ''),
      updatedAt: Number(parsed?.updatedAt || 0),
    }
  } catch {
    return { identity: '妈妈', nickname: '', updatedAt: 0 }
  }
}

export function saveParentInfo(input: { identity?: string; nickname: string }) {
  const prev = loadParentInfo()
  const next: ParentInfo = {
    identity: input.identity?.trim() || prev.identity || '妈妈',
    nickname: input.nickname.trim(),
    updatedAt: Date.now(),
  }
  Taro.setStorageSync(PARENT_INFO_KEY, JSON.stringify(next))
}

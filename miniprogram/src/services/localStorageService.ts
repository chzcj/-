import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '@/config/env'

const EXTRA_PREFIXES = ['yujian_']

/** 清空本机 ChildOS 本地缓存（换账号防串数据）。保留当前 session token。 */
export function clearAllChildOSData() {
  try {
    const info = Taro.getStorageInfoSync()
    for (const key of info.keys) {
      if (key === STORAGE_KEYS.sessionToken) continue
      if (key.startsWith('childos') || EXTRA_PREFIXES.some((p) => key.startsWith(p))) {
        Taro.removeStorageSync(key)
      }
    }
  } catch {
    /* ignore */
  }
}

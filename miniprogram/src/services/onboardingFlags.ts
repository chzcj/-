import Taro from '@tarojs/taro'

const INTRO_SEEN_KEY = 'yujian_intro_seen_v1'

export function hasIntroSeen(): boolean {
  try {
    return Taro.getStorageSync(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen() {
  try {
    Taro.setStorageSync(INTRO_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

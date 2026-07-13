import Taro from '@tarojs/taro'

const KEY = 'yujian_privacy_consent_v1'

export function hasPrivacyConsent(): boolean {
  try {
    return Taro.getStorageSync(KEY) === '1'
  } catch {
    return false
  }
}

export function setPrivacyConsent(agreed: boolean) {
  try {
    if (agreed) Taro.setStorageSync(KEY, '1')
    else Taro.removeStorageSync(KEY)
  } catch {
    /* ignore */
  }
}

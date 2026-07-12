import Taro from '@tarojs/taro'
import { ensurePrivacyAuthorized } from '@/lib/wechatPrivacy'

/** 请求麦克风权限；已拒绝时引导打开设置页 */
export async function ensureRecordPermission(): Promise<{ ok: true } | { ok: false; message: string }> {
  const privacy = await ensurePrivacyAuthorized()
  if (!privacy.ok) return privacy

  try {
    const { authSetting } = await Taro.getSetting()
    if (authSetting['scope.record']) return { ok: true }

    if (authSetting['scope.record'] === false) {
      const opened = await Taro.openSetting()
      if (opened.authSetting['scope.record']) return { ok: true }
      return { ok: false, message: '麦克风权限没有打开，可以在设置中允许后再试。' }
    }

    await Taro.authorize({ scope: 'scope.record' })
    return { ok: true }
  } catch {
    return { ok: false, message: '麦克风权限没有打开，可以允许权限后再试。' }
  }
}

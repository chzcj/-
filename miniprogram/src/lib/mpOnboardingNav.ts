import Taro from '@tarojs/taro'
import { setSupplementFlow } from '@/services/entryStorage'

/**
 * Onboarding 前进导航：用 redirectTo 避免四模块走完时页面栈超过 10 层导致 navigateTo 静默失败。
 */
export async function mpGoReplace(url: string): Promise<boolean> {
  try {
    await Taro.redirectTo({ url })
    return true
  } catch {
    try {
      await Taro.reLaunch({ url })
      return true
    } catch {
      Taro.showToast({ title: '页面跳转失败，请从模块入口重试', icon: 'none', duration: 2800 })
      return false
    }
  }
}

/** 退出补充流，回到画像 Tab */
export function exitSupplementToProfile() {
  setSupplementFlow(false)
  void Taro.switchTab({ url: '/pages/profile/index' })
}

/** 回到四模块 hub（补充/重填入口） */
export function goOnboardingHub() {
  void mpGoReplace('/packageOnboarding/pages/hub/index')
}

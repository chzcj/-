import Taro from '@tarojs/taro'
import type { AuthUser } from '@yujian/contracts'

const TAB_PAGES = new Set([
  '/pages/daily/index',
  '/pages/tasks/index',
  '/pages/rehearsal/index',
  '/pages/profile/index',
])

/** Tab 页必须用 switchTab，否则微信报「页面不存在」 */
function goTo(url: string, replace = true) {
  const path = url.split('?')[0]
  if (TAB_PAGES.has(path)) {
    void Taro.switchTab({ url: path })
    return
  }
  if (replace) {
    void Taro.reLaunch({ url })
  } else {
    void Taro.redirectTo({ url })
  }
}

export function routeAfterAuth(user: AuthUser, replace = true) {
  if (!user.onboardingComplete) {
    goTo('/packageOnboarding/pages/intro/index', replace)
    return
  }
  goTo('/pages/daily/index', replace)
}

export function requireOnboardingComplete(user: AuthUser | null) {
  if (!user) {
    void Taro.reLaunch({ url: '/pages/login/index' })
    return false
  }
  if (!user.onboardingComplete) {
    void Taro.reLaunch({ url: '/packageOnboarding/pages/intro/index' })
    return false
  }
  return true
}

export function goToRehearsalTab() {
  void Taro.switchTab({ url: '/pages/rehearsal/index' })
}

export function goToDailyTab() {
  void Taro.switchTab({ url: '/pages/daily/index' })
}

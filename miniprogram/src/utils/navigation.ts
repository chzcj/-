import Taro from '@tarojs/taro'
import type { AuthUser } from '@yujian/contracts'
import { BUILD_MODULES, loadBuildState } from '@/services/buildState'
import { hasIntroSeen, markIntroSeen } from '@/services/onboardingFlags'

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

/** 建档未完成时的落点：未看过 intro/guide → intro；已看过或已开模块 → hub */
export function onboardingIncompleteHref(): string {
  if (hasIntroSeen()) return '/packageOnboarding/pages/hub/index'
  const state = loadBuildState()
  const started = BUILD_MODULES.some((m) => {
    const mod = state.entryMap[m.key]
    return Boolean(mod?.moduleComplete || mod?.rawTexts?.length || mod?.stageSummary)
  })
  if (started) {
    markIntroSeen()
    return '/packageOnboarding/pages/hub/index'
  }
  return '/packageOnboarding/pages/intro/index'
}

export function routeAfterAuth(user: AuthUser, replace = true) {
  if (!user.onboardingComplete) {
    goTo(onboardingIncompleteHref(), replace)
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
    void Taro.reLaunch({ url: onboardingIncompleteHref() })
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

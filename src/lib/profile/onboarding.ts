import { buildOnboardingHref } from '@/lib/profile/buildGate'
import { hasProfile } from '@/lib/storage/profileStorage'

const ONBOARDING_FLAG = 'childos_onboarding_complete'

/** 四模块 + 画像生成完成，才解锁交流/预演/任务 */
export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false
  if (hasProfile()) return true
  try {
    if (localStorage.getItem(ONBOARDING_FLAG) === '1') return true
  } catch {
    /* ignore */
  }
  return false
}

export function markOnboardingComplete() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ONBOARDING_FLAG, '1')
  } catch {
    /* ignore */
  }
}

/** 主 Tab 路由：未完成四模块时回到采集流程（intro → basic → 线性采集） */
export function onboardingHomeHref(): string {
  return isOnboardingComplete() ? '/daily' : buildOnboardingHref()
}

export const ONBOARDING_LOCKED_PREFIXES = ['/daily', '/tasks', '/rehearsal', '/family-profile']

export function isOnboardingLockedPath(pathname: string): boolean {
  return ONBOARDING_LOCKED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

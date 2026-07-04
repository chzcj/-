'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isOnboardingComplete, isOnboardingLockedPath } from '@/lib/profile/onboarding'
import { buildOnboardingHref } from '@/lib/profile/buildGate'
import { hydrateProfileFromRemoteIfNeeded } from '@/lib/profile/profileHydrate'

/** 未完成四模块画像时，拦截主 Tab 页面并重定向到采集 hub */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(() => isOnboardingComplete())

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!pathname) return

      if (isOnboardingComplete()) {
        if (!cancelled) setReady(true)
        return
      }

      if (!isOnboardingLockedPath(pathname)) {
        if (!cancelled) setReady(true)
        return
      }

      await hydrateProfileFromRemoteIfNeeded()
      if (cancelled) return

      if (isOnboardingComplete()) {
        setReady(true)
        return
      }

      router.replace(buildOnboardingHref())
    })()

    return () => {
      cancelled = true
    }
  }, [pathname, router])

  if (!ready && pathname && isOnboardingLockedPath(pathname) && !isOnboardingComplete()) {
    return <div className="page profile-build-loading">正在同步孩子画像…</div>
  }

  return <>{children}</>
}

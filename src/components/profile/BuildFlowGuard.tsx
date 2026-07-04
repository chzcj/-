'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { entryConfigs } from '@/data/entryConfig'
import { getBuildOnboardingStep } from '@/lib/profile/buildGate'
import { isBuildRouteAllowed } from '@/lib/profile/buildGateState'
import { isOnboardingComplete } from '@/lib/profile/onboarding'
import { getAllEntryStatuses } from '@/lib/storage/entryStorage'

const ENTRY_PREFIX = /^\/profile\/build\/(daily|homework|communication|family|study|routine|emotion|environment)(\/|$)/

/** 四模块子流程门禁：intro → basic → 线性采集（含追问）→ hub 收尾 */
export function BuildFlowGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reviewIntro = searchParams.get('review') === '1'
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!pathname?.startsWith('/profile/build')) {
      setReady(true)
      return
    }

    if (isOnboardingComplete()) {
      if (pathname === '/profile/build/intro' && !reviewIntro) {
        router.replace('/profile/build')
        return
      }
      setReady(isBuildRouteAllowed(pathname, reviewIntro))
      return
    }

    const step = getBuildOnboardingStep()

    if (pathname === '/profile/build/intro') {
      if (!reviewIntro) {
        if (step === 'basic') router.replace('/profile/build/basic')
        else if (step === 'hub') router.replace('/profile/build')
      }
      setReady(isBuildRouteAllowed(pathname, reviewIntro))
      return
    }

    if (pathname === '/profile/build/basic') {
      if (step === 'intro') router.replace('/profile/build/intro')
      else if (step === 'hub') router.replace('/profile/build')
      setReady(isBuildRouteAllowed(pathname, reviewIntro))
      return
    }

    if (pathname === '/profile/build/final-follow-up') {
      const statuses = getAllEntryStatuses()
      const allDone = entryConfigs.every((e) => statuses[e.type] === 'completed')
      if (!allDone) router.replace('/profile/build')
      setReady(isBuildRouteAllowed(pathname, reviewIntro))
      return
    }

    const needsHub = pathname === '/profile/build' || ENTRY_PREFIX.test(pathname)
    if (needsHub && step === 'intro') router.replace('/profile/build/intro')
    else if (needsHub && step === 'basic') router.replace('/profile/build/basic')

    setReady(isBuildRouteAllowed(pathname, reviewIntro))
  }, [pathname, reviewIntro, router])

  if (!ready) {
    return <div className="page profile-build-loading">加载中…</div>
  }

  return <>{children}</>
}

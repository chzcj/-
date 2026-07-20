'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import type { TabKey } from '@/components/layout/BottomNavTabs'
import { HiFiBottomNav } from '@/components/hifi/HiFiBottomNav'
import { HiFiDesktopNav } from '@/components/hifi/HiFiDesktopNav'
import { useKeyboardOffset } from '@/hooks/useKeyboardOffset'
import { pushAccountSyncToServer } from '@/lib/account/accountSync'
import { isOnboardingComplete } from '@/lib/profile/onboarding'

const MAIN_TAB_ROUTES = new Set(['/daily', '/tasks', '/rehearsal', '/family-profile'])
const ANIM_SEEN_KEY = 'hifi_page_anim_seen'

type HiFiMainShellProps = {
  activeTab: TabKey
  children: ReactNode
  inputZone?: ReactNode
  showInput?: boolean
  recordingPanel?: ReactNode
  /** 主 Tab 回访时跳过进场动画，减轻切换卡顿感 */
  animate?: boolean
  /** 画像等页面使用纯白底 */
  surface?: 'default' | 'white'
  /** 预演对话屏等全屏沉浸态隐藏底栏 */
  showBottomNav?: boolean
}

/** 对齐 design-reference/extracted/2-main-app.html 的 app-shell 结构与 switchTab 动效 */
export function HiFiMainShell({
  activeTab,
  children,
  inputZone,
  showInput = false,
  recordingPanel,
  animate = true,
  surface = 'default',
  showBottomNav: showBottomNavProp,
}: HiFiMainShellProps) {
  const pathname = usePathname()
  const pageRef = useRef<HTMLElement>(null)
  const [onboardingNav, setOnboardingNav] = useState(() => isOnboardingComplete())
  const showBottomNav = showBottomNavProp ?? onboardingNav
  useKeyboardOffset()

  useEffect(() => {
    setOnboardingNav(isOnboardingComplete())
  }, [pathname])

  useEffect(() => {
    const page = pageRef.current
    if (!page) return

    page.classList.remove('page-entering')
    page.scrollTop = 0

    if (!animate) return

    let seen: string[] = []
    try {
      seen = JSON.parse(sessionStorage.getItem(ANIM_SEEN_KEY) || '[]') as string[]
    } catch {
      seen = []
    }
    const isMainTab = pathname && MAIN_TAB_ROUTES.has(pathname)
    const skipEnter = Boolean(isMainTab && pathname && seen.includes(pathname))

    if (skipEnter) return

    void page.offsetWidth
    const frame = window.requestAnimationFrame(() => {
      page.classList.add('page-entering')
    })
    const timer = window.setTimeout(() => {
      page.classList.remove('page-entering')
      if (isMainTab && pathname) {
        try {
          const next = seen.includes(pathname) ? seen : [...seen, pathname]
          sessionStorage.setItem(ANIM_SEEN_KEY, JSON.stringify(next.slice(-8)))
        } catch {
          /* ignore */
        }
      }
    }, 220)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [pathname, animate])

  useEffect(() => {
    const onHide = () => pushAccountSyncToServer()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

  return (
    <div className={`hifi-app-root hifi-desktop-app${surface === 'white' ? ' surface-white' : ''}`}>
      <div className="app-desktop-grid">
        {showBottomNav ? <HiFiDesktopNav active={activeTab} /> : null}
        <main className="app-shell app-main-column" aria-label="育见">
          <div className="app-safe-top" aria-hidden="true" />
          <section className="page-stack">
            <section ref={pageRef} className="page active">
              {children}
            </section>
          </section>
          {recordingPanel}
          {showInput ? inputZone : null}
          {showBottomNav ? <HiFiBottomNav active={activeTab} /> : null}
        </main>
      </div>
    </div>
  )
}

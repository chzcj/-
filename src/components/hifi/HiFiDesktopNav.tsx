'use client'

import { useRouter } from 'next/navigation'
import { buildOnboardingHref } from '@/lib/profile/buildGate'
import { isOnboardingComplete } from '@/lib/profile/onboarding'
import type { TabKey } from '@/components/layout/BottomNavTabs'
import { HIFI_TAB_ROUTES, HIFI_TABS } from '@/components/hifi/hifiTabs'

export function HiFiDesktopNav({ active }: { active: TabKey }) {
  const router = useRouter()
  const locked = !isOnboardingComplete()

  function go(tab: TabKey) {
    if (locked) {
      router.push(buildOnboardingHref())
      return
    }
    if (tab !== active) router.push(HIFI_TAB_ROUTES[tab])
  }

  return (
    <aside className="desktop-nav-rail" aria-label="主导航">
      <div className="desktop-nav-brand">
        <span className="desktop-nav-mark" aria-hidden="true" />
        <div>
          <p className="desktop-nav-kicker">ChildOS</p>
          <h1 className="desktop-nav-title">育见</h1>
        </div>
      </div>
      <p className="desktop-nav-lede">帮家长看见孩子，而不是只看见问题。</p>
      <nav className="desktop-nav-list">
        {HIFI_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`desktop-nav-item${active === tab.key ? ' is-active' : ''}`}
            onClick={() => go(tab.key)}
            aria-current={active === tab.key ? 'page' : undefined}
          >
            <span className="desktop-nav-icon">{tab.icon}</span>
            <span className="desktop-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

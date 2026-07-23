'use client'

import { useRouter } from 'next/navigation'
import { buildOnboardingHref } from '@/lib/profile/buildGate'
import { isOnboardingComplete } from '@/lib/profile/onboarding'
import type { TabKey } from '@/components/layout/BottomNavTabs'
import { HIFI_TAB_ROUTES, HIFI_TABS } from '@/components/hifi/hifiTabs'

export function HiFiBottomNav({ active }: { active: TabKey }) {
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
    <section className="bottom-tabs-wrap mobile-bottom-nav">
      <nav className="bottom-tabs" aria-label="底部导航">
        {HIFI_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-button${active === tab.key ? ' active' : ''}`}
            onClick={() => go(tab.key)}
            aria-current={active === tab.key ? 'page' : undefined}
          >
            {tab.icon}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </section>
  )
}

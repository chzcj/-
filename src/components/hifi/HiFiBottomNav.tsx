'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { buildOnboardingHref } from '@/lib/profile/buildGate'
import { isOnboardingComplete } from '@/lib/profile/onboarding'
import type { TabKey } from '@/components/layout/BottomNavTabs'

const TAB_ROUTES: Record<TabKey, string> = {
  chat: '/daily',
  tasks: '/tasks',
  rehearsal: '/rehearsal',
  profile: '/family-profile',
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M14 5.4c-5.25 0-9.35 3.45-9.35 7.78 0 2.18 1.05 4.12 2.78 5.52l-.6 3.9 3.78-2.12c1.04.34 2.18.52 3.39.52 5.25 0 9.35-3.45 9.35-7.82S19.25 5.4 14 5.4z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.5 13.15h.01M14 13.15h.01M17.5 13.15h.01" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
    </svg>
  )
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M10.2 5.9H8.1a2.2 2.2 0 0 0-2.2 2.2v14.1a2.2 2.2 0 0 0 2.2 2.2h11.8a2.2 2.2 0 0 0 2.2-2.2V8.1a2.2 2.2 0 0 0-2.2-2.2h-2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.3 3.7h5.4c.6 0 1.1.5 1.1 1.1v2.6c0 .6-.5 1.1-1.1 1.1h-5.4c-.6 0-1.1-.5-1.1-1.1V4.8c0-.6.5-1.1 1.1-1.1z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path d="M10.4 15.1l2.55 2.55 5-5.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RehearsalIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M12.9 4.2l1.35 4.15a3.2 3.2 0 0 0 2.02 2.02l4.15 1.35-4.15 1.35a3.2 3.2 0 0 0-2.02 2.02l-1.35 4.15-1.35-4.15a3.2 3.2 0 0 0-2.02-2.02l-4.15-1.35 4.15-1.35a3.2 3.2 0 0 0 2.02-2.02L12.9 4.2z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.65 16.3l.72 2.15a1.6 1.6 0 0 0 1.02 1.02l2.15.72-2.15.72a1.6 1.6 0 0 0-1.02 1.02l-.72 2.15-.72-2.15a1.6 1.6 0 0 0-1.02-1.02l-2.15-.72 2.15-.72a1.6 1.6 0 0 0 1.02-1.02l.72-2.15z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M14 24.4c5.74 0 10.4-4.66 10.4-10.4S19.74 3.6 14 3.6 3.6 8.26 3.6 14 8.26 24.4 14 24.4z" stroke="currentColor" />
      <path d="M10.1 11.7h.01M17.9 11.7h.01" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M9.8 16.4c1.05 1.45 2.45 2.17 4.2 2.17s3.15-.72 4.2-2.17" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

const TABS: { key: TabKey; label: string; icon: ReactNode }[] = [
  { key: 'chat', label: '交流', icon: <ChatIcon /> },
  { key: 'tasks', label: '任务', icon: <TasksIcon /> },
  { key: 'rehearsal', label: '预演', icon: <RehearsalIcon /> },
  { key: 'profile', label: '画像', icon: <ProfileIcon /> },
]

export function HiFiBottomNav({ active }: { active: TabKey }) {
  const router = useRouter()
  const locked = !isOnboardingComplete()

  function go(tab: TabKey) {
    if (locked) {
      router.push(buildOnboardingHref())
      return
    }
    if (tab !== active) router.push(TAB_ROUTES[tab])
  }

  return (
    <section className="bottom-tabs-wrap">
      <nav className="bottom-tabs" aria-label="底部导航">
        {TABS.map((tab) => (
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

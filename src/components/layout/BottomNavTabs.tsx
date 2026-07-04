'use client'

import { ClipboardList, MessageCircle, Mic, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { buildOnboardingHref } from '@/lib/profile/buildGate'
import { isOnboardingComplete } from '@/lib/profile/onboarding'

/** 主导航四 Tab：交流 / 任务 / 预演 / 画像（对齐高保真 HTML） */
export type TabKey = 'chat' | 'tasks' | 'rehearsal' | 'profile'

/** 历史 active 值兼容：画像子流程等仍传 profile；旧 home/record 映射到新 Tab */
export type TabKeyCompat = TabKey | 'home' | 'record' | 'board' | 'diagnosis' | 'legacy'

function resolveActive(active: TabKeyCompat): TabKey | null {
  if (active === 'chat' || active === 'home') return 'chat'
  if (active === 'tasks' || active === 'record' || active === 'board') return 'tasks'
  if (active === 'rehearsal' || active === 'diagnosis') return 'rehearsal'
  if (active === 'profile') return 'profile'
  return null
}

const TAB_ROUTES: Record<TabKey, string> = {
  chat: '/daily',
  tasks: '/tasks',
  rehearsal: '/rehearsal',
  profile: '/family-profile',
}

export function BottomNavTabs({ active }: { active: TabKeyCompat }) {
  const router = useRouter()
  const current = resolveActive(active)
  const locked = !isOnboardingComplete()

  function go(tab: TabKey) {
    if (locked) {
      router.push(buildOnboardingHref())
      return
    }
    router.push(TAB_ROUTES[tab])
  }

  return (
    <nav className="talk-tabs" aria-label="底部导航">
      <button
        type="button"
        className={current === 'chat' ? 'active' : ''}
        onClick={() => go('chat')}
        aria-current={current === 'chat' ? 'page' : undefined}
      >
        <MessageCircle size={20} />
        <span>交流</span>
      </button>
      <button
        type="button"
        className={current === 'tasks' ? 'active' : ''}
        onClick={() => go('tasks')}
        aria-current={current === 'tasks' ? 'page' : undefined}
      >
        <ClipboardList size={20} />
        <span>任务</span>
      </button>
      <button
        type="button"
        className={current === 'rehearsal' ? 'active' : ''}
        onClick={() => go('rehearsal')}
        aria-current={current === 'rehearsal' ? 'page' : undefined}
      >
        <Mic size={20} />
        <span>预演</span>
      </button>
      <button
        type="button"
        className={current === 'profile' ? 'active' : ''}
        onClick={() => go('profile')}
        aria-current={current === 'profile' ? 'page' : undefined}
      >
        <UserRound size={20} />
        <span>画像</span>
      </button>
    </nav>
  )
}

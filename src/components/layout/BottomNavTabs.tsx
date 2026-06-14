'use client'
import { Archive, BookOpenText, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'

export type TabKey = 'home' | 'rehearsal' | 'record' | 'profile'

export function BottomNavTabs({ active }: { active: TabKey }) {
  const router = useRouter()
  return (
    <nav className="talk-tabs" aria-label="底部模块">
      <button type="button" className={active === 'home' ? 'active' : ''} onClick={() => router.push('/home')}>
        <MessageCircle size={20} />
        <span>对话</span>
      </button>
      <button type="button" className={active === 'rehearsal' ? 'active' : ''} onClick={() => router.push('/rehearsal')}>
        <Mic size={20} />
        <span>沟通预演</span>
      </button>
      <button type="button" className={active === 'record' ? 'active' : ''} onClick={() => router.push('/record-child')}>
        <BookOpenText size={20} />
        <span>记录孩子</span>
      </button>
      <button type="button" className={active === 'profile' ? 'active' : ''} onClick={() => router.push('/family-profile')}>
        <Archive size={20} />
        <span>档案</span>
      </button>
    </nav>
  )
}

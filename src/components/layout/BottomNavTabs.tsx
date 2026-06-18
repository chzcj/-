'use client'
import { BookOpenText, GraduationCap, LayoutDashboard, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'

// 'profile' 为历史兼容值（旧档案 tab 已下线）：仍合法，但不对应任何 tab → 不高亮。
// 这样 24 个 active="profile" 的画像/档案子页无需逐个改，只是底栏不高亮（它们本就不在主导航里）。
export type TabKey = 'home' | 'rehearsal' | 'diagnosis' | 'record' | 'board' | 'profile'

/* 主导航 5 项（对齐交付文档）：对话 / 预演 / 诊断 / 记录 / 看板。
   家庭规划不占 tab——从首页专项卡 + 教育诊断结果页 + 看板「下一步」进入；
   档案不占 tab——从首页「孩子画像」卡 + 看板「查看完整档案」进入。 */
export function BottomNavTabs({ active }: { active: TabKey }) {
  const router = useRouter()
  return (
    <nav className="talk-tabs talk-tabs-five" aria-label="底部模块">
      <button type="button" className={active === 'home' ? 'active' : ''} onClick={() => router.push('/home')}>
        <MessageCircle size={20} />
        <span>对话</span>
      </button>
      <button type="button" className={active === 'rehearsal' ? 'active' : ''} onClick={() => router.push('/rehearsal')}>
        <Mic size={20} />
        <span>预演</span>
      </button>
      <button type="button" className={active === 'diagnosis' ? 'active' : ''} onClick={() => router.push('/education-diagnosis')}>
        <GraduationCap size={20} />
        <span>诊断</span>
      </button>
      <button type="button" className={active === 'record' ? 'active' : ''} onClick={() => router.push('/record-child')}>
        <BookOpenText size={20} />
        <span>记录</span>
      </button>
      <button type="button" className={active === 'board' ? 'active' : ''} onClick={() => router.push('/board')}>
        <LayoutDashboard size={20} />
        <span>看板</span>
      </button>
    </nav>
  )
}

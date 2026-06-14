'use client'
import { Camera, Eye, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { FollowUpCard } from '@/components/ai/FollowUpCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { mockFinalFollowUp } from '@/data/mockOutputs'

export default function FinalFollowUpPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const fu = mockFinalFollowUp

  function handleSubmit() {
    if (!text.trim() || loading) return
    setLoading(true)
    setTimeout(() => { setLoading(false); router.push('/profile/generating') }, 300)
  }

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="综合补充" showBack onBack={() => router.push('/profile/build')} />
        <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6, marginTop: 4 }}>
          五部分已经基本够了，我还想再补一个关键点
        </div>
        <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 16 }}>这一步很关键，能帮系统把主判断收得更准</div>
        <FollowUpCard purpose={fu.purpose} directions={fu.directions} voicePrompt={fu.voicePrompt} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="把刚才想到的场景写在这里..."
          style={{ width: '100%', minHeight: 100, borderRadius: 20, border: '1px solid rgba(29,29,31,0.08)', background: 'rgba(255,255,255,0.72)', padding: 14, fontSize: 15, lineHeight: 1.55, color: '#1D1D1F', resize: 'vertical', outline: 'none', fontFamily: 'inherit', marginTop: 14 }} />
        <button type="button" className="primary-button" onClick={handleSubmit} disabled={!text.trim() || loading}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 14 }}>继续补充</button>
        <NavTabs router={router} />
      </div>
    </AppShell>
  )
}
function NavTabs({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <BottomNavTabs active="profile" />
  )
}

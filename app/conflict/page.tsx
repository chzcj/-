'use client'
import { Camera, Eye, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar'
import { hasProfile } from '@/lib/storage/profileStorage'
import type { InputMode } from '@/types/childos'

export default function ConflictPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  function handleSubmit(text: string, _mode: InputMode) {
    if (!text.trim() || loading) return
    if (!hasProfile()) { alert('请先建立孩子画像'); router.push('/profile/build'); return }
    setLoading(true)
    setTimeout(() => { setLoading(false); router.push('/conflict/result?text=' + encodeURIComponent(text.trim())) }, 500)
  }

  return (
    <AppShell>
      <div className="page with-raised-voice">



        <PageHeader title="冲突复盘" showBack onBack={() => router.push('/home')} />
        <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>
          把刚才那次争吵，尽量原样交给我
        </div>
        <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14 }}>录一段/贴一段，越接近原话 复盘越准</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {['争作业', '说手机', '顶嘴'].map((c) => <span key={c} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{c}</span>)}
        </div>
        <BottomNavTabs active="rehearsal" />
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint="把刚才那次争吵，尽量原样告诉我" disabled={loading} elevated onSubmit={handleSubmit} />
    </AppShell>
  )
}

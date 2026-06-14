'use client'
import { ArrowRight, Camera, Eye, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar'
import { hasProfile } from '@/lib/storage/profileStorage'
import type { InputMode } from '@/types/childos'

export default function RehearsalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  function handleSubmit(text: string, _mode: InputMode) {
    if (!text.trim() || loading) return
    setLoading(true)
    setTimeout(() => { setLoading(false); router.push('/rehearsal/result?text=' + encodeURIComponent(text.trim())) }, 500)
  }

  const profileReady = hasProfile()

  return (
    <AppShell>
      <div className="page capture-page with-capture-dock">
        <PageHeader title="沟通预演" showBack onBack={() => router.push('/home')} />
        {profileReady ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>
              把您现在最想对孩子说的话，直接写进来
            </div>
            <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14 }}>不用润色，按您平时会说的话来</div>
          </>
        ) : (
          <div className="card" style={{ padding: 20, borderRadius: 22, marginBottom: 14, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
            <div style={{ fontSize: 16, fontWeight: 650, color: '#1D1D1F', marginBottom: 8 }}>还没建立孩子画像</div>
            <div style={{ fontSize: 14, color: '#6E6E73', lineHeight: 1.5, marginBottom: 14 }}>
              在画像未建立前，预演会用通用模式分析您的沟通方式。
              为了获得更准确、更贴合您家孩子的分析，建议先花几分钟建立画像。
            </div>
            <button type="button" className="secondary-button"
              onClick={() => router.push('/profile/build')}
              style={{ width: '100%', borderRadius: 999, height: 48, fontSize: 15, fontWeight: 600 }}>
              先去建立孩子画像
              <ArrowRight size={16} style={{ marginLeft: 6 }} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {['催作业', '聊成绩', '说手机'].map((c) => <span key={c} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{c}</span>)}
        </div>
        <BottomNavTabs active="rehearsal" />
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint="把你准备对孩子说的话发来" disabled={loading} elevated onSubmit={handleSubmit} />
    </AppShell>
  )
}
